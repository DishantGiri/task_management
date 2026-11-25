import dns from "node:dns";
import net from "node:net";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { invalidateWorkspaceCache } from "@/lib/cache/redis";
import { authConfig, SUPER_ADMIN_EMAIL } from "./auth.config";

// Force IPv4 for Google OAuth endpoints to prevent Node 22 undici IPv6 ETIMEDOUT
try {
  dns.setDefaultResultOrder("ipv4first");
  if (typeof net.setDefaultAutoSelectFamily === "function") {
    net.setDefaultAutoSelectFamily(false);
  }
  const originalLookup = dns.lookup.bind(dns) as (
    ...args: unknown[]
  ) => unknown;
  // @ts-expect-error override dns.lookup to filter out unreachable IPv6 AAAA records for Google hosts
  dns.lookup = function (
    hostname: string,
    options: unknown,
    callback?: unknown
  ) {
    const isGoogleHost =
      typeof hostname === "string" &&
      (hostname.endsWith("google.com") || hostname.endsWith("googleapis.com"));

    if (typeof options === "function") {
      return originalLookup(
        hostname,
        isGoogleHost ? { family: 4 } : {},
        options
      );
    }

    if (isGoogleHost && typeof options === "object" && options !== null) {
      const opts = { ...(options as Record<string, unknown>) };
      if (opts.all) {
        return originalLookup(
          hostname,
          opts,
          (err: NodeJS.ErrnoException | null, addresses: unknown) => {
            if (Array.isArray(addresses)) {
              const ipv4Only = addresses.filter(
                (a: { family?: number }) => a.family === 4
              );
              return (callback as CallableFunction)(
                err,
                ipv4Only.length > 0 ? ipv4Only : addresses
              );
            }
            return (callback as CallableFunction)(err, addresses);
          }
        );
      }
      opts.family = 4;
      return originalLookup(hostname, opts, callback);
    }

    return originalLookup(hostname, options, callback);
  };
} catch {
  // Ignore if unsupported in edge runtime
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret:
        process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: {
          prompt: "select_account",
          scope: "openid email profile",
          response_type: "code",
        },
      },
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
      issuer: "https://accounts.google.com",
      jwks_endpoint: "https://www.googleapis.com/oauth2/v3/certs",
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user?.email) {
        return false;
      }

      const email = user.email.toLowerCase().trim();
      const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
      const googleAvatar =
        (profile as { picture?: string } | undefined)?.picture ||
        user.image ||
        null;

      const existing = await prisma.user.findUnique({
        where: { email },
      });

      if (isSuperAdmin) {
        const adminUser = await prisma.user.upsert({
          where: { email },
          update: {
            role: "ADMIN",
            status: "ACTIVE",
            name: existing?.name || user.name || "Dishant Giri",
            avatarUrl: googleAvatar || existing?.avatarUrl || null,
          },
          create: {
            name: user.name || "Dishant Giri",
            email,
            passwordHash: "",
            avatarUrl: googleAvatar,
            role: "ADMIN",
            status: "ACTIVE",
            designation: "Company Administrator",
          },
        });
        user.id = adminUser.id;
        await invalidateWorkspaceCache();
        return true;
      }

      if (!existing) {
        const displayName = user.name?.trim() || email.split("@")[0];
        const created = await prisma.user.create({
          data: {
            name: displayName,
            email,
            passwordHash: "",
            avatarUrl: googleAvatar,
            role: "EMPLOYEE",
            status: "PENDING",
            designation: "Awaiting Admin Approval",
          },
        });
        user.id = created.id;

        // Notify all active Admins that a new employee is on hold awaiting role & approval
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", status: "ACTIVE" },
          select: { id: true },
        });
        if (admins.length > 0) {
          await prisma.notification.createMany({
            data: admins.map((adm) => ({
              userId: adm.id,
              actorId: created.id,
              type: "PROJECT_ADDED",
              title: `Approval needed: ${displayName}`,
              message: `${displayName} (${email}) signed in with Google and is on hold awaiting role assignment and approval.`,
              link: "/team?status=PENDING",
            })),
          });
        }
      } else {
        const updated = await prisma.user.update({
          where: { id: existing.id },
          data: {
            avatarUrl: googleAvatar || existing.avatarUrl || null,
            name: existing.name || user.name || email.split("@")[0],
          },
        });
        user.id = updated.id;
      }

      await invalidateWorkspaceCache();
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.email) {
        const email = user.email.toLowerCase().trim();
        const dbUser = await prisma.user.findUnique({
          where: { email },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.role = dbUser.role;
          token.status = dbUser.status;
          token.designation = dbUser.designation;
          // Keep JWT cookie small for Nginx; live avatarUrl is fetched from DB via getCurrentUser()
          token.avatarUrl = null;
          token.departmentId = dbUser.departmentId;
        }
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.designation !== undefined)
          token.designation = session.designation;
      }
      delete token.picture;
      return token;
    },
  },
});
