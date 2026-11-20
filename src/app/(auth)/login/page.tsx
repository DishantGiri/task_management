"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { googleLoginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MOCK_ROLES = [
  {
    key: "ADMIN" as const,
    label: "Admin",
    sub: "Full access",
    icon: Shield,
    accent: "text-[#635BDB]",
  },
  {
    key: "MANAGER" as const,
    label: "Manager",
    sub: "Projects & tasks",
    icon: Users,
    accent: "text-[#3B82F6]",
  },
  {
    key: "EMPLOYEE" as const,
    label: "Employee",
    sub: "Assigned work",
    icon: UserCheck,
    accent: "text-[#16A34A]",
  },
  {
    key: "PENDING" as const,
    label: "On Hold",
    sub: "Pending approval",
    icon: Clock,
    accent: "text-[#F59E0B]",
  },
];

function LoginCard() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [mockLoading, setMockLoading] = useState<string | null>(null);
  const authError = searchParams.get("error");

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await googleLoginAction();
    } catch {
      // NextAuth signIn throws NEXT_REDIRECT which Next.js handles automatically
    }
  };

  const handleMockLogin = async (
    roleKey: "ADMIN" | "MANAGER" | "EMPLOYEE" | "PENDING"
  ) => {
    setMockLoading(roleKey);
    try {
      const response = await fetch("/api/mock-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey }),
      });

      const rawText = await response.text();
      let res: { success?: boolean; redirectTo?: string; error?: string } = {};
      try {
        res = JSON.parse(rawText);
      } catch {
        res = {
          error: `Server returned HTTP ${response.status} (non-JSON response).`,
        };
      }

      if (!response.ok || res?.error) {
        toast.error(res?.error || `Mock login failed (HTTP ${response.status}).`);
        setMockLoading(null);
        return;
      }
      toast.success(`Signed in as ${roleKey}`);
      window.location.href = res?.redirectTo || "/dashboard";
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Could not reach the server. Please try again."
      );
      setMockLoading(null);
    }
  };

  return (
    <Card className="border-[#EAECF0] shadow-card">
      <CardHeader className="pb-4 text-center">
        <CardTitle className="text-[18px]">
          Sign in to Meridian Workspace
        </CardTitle>
        <CardDescription>
          Continue with your company Google account to access projects and tasks.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {authError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Google authentication failed or was cancelled. Please try again.
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full h-10 gap-2.5 border-[#D5D9E2] bg-white text-[13.5px] font-medium text-[#20232B] hover:bg-[#F7F8FA]"
          onClick={handleGoogleSignIn}
          disabled={loading || !!mockLoading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#635BDB]" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        {/* Quick Mock Role Login Section for Testing */}
        <div className="pt-3 border-t border-[#EAECF0]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737987] mb-2 text-center">
            Quick Mock Login (Role Testing)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MOCK_ROLES.map((r) => {
              const Icon = r.icon;
              const isBusy = mockLoading === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  disabled={loading || !!mockLoading}
                  onClick={() => handleMockLogin(r.key)}
                  className="flex items-center gap-2.5 rounded-md border border-[#EAECF0] bg-[#F7F8FA] px-3 py-2 text-left transition-colors hover:border-[#635BDB]/50 hover:bg-[#F0EFFF]/60 disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#635BDB] shrink-0" />
                  ) : (
                    <Icon className={`h-4 w-4 shrink-0 ${r.accent}`} />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#20232B] leading-tight">
                      {r.label}
                    </p>
                    <p className="text-[10.5px] text-[#737987] truncate">
                      {r.sub}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-3 text-[11.5px] text-[#525866] space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-[#20232B]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#635BDB]" />
            Admin-Controlled Workspace Access
          </div>
          <p className="text-[#737987] leading-relaxed">
            First-time sign-ins via company Gmail are placed on hold until an
            administrator approves your account and assigns your role.
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#9CA3AF]">
          <Lock className="h-3 w-3" />
          <span>Secured with Google OAuth 2.0</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
