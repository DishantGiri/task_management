import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { withCache } from "@/lib/cache/redis";

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }
  // Block private IPv4 ranges
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }
  return false;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
        "i"
      ),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return decodeHtmlEntities(m[1]);
    }
  }
  return null;
}

function resolveRelativeUrl(raw: string | null, baseUrl: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = request.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  if (isBlockedHostname(parsed.hostname)) {
    return NextResponse.json({ error: "Blocked host" }, { status: 400 });
  }

  const hostname = parsed.hostname.replace(/^www\./i, "");
  const defaultFavicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    parsed.hostname
  )}&sz=64`;

  const cacheKey = `meridian:link-preview:v1:${parsed.toString()}`;

  const data = await withCache(cacheKey, 3600, async () => {
    try {
      const res = await fetch(parsed.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MeridianLinkPreview/1.0; +https://meridian.dailyworkreport.com)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) {
        return {
          url: parsed.toString(),
          title: hostname,
          description: "",
          image: null,
          favicon: defaultFavicon,
          siteName: hostname,
        };
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.startsWith("image/")) {
        return {
          url: parsed.toString(),
          title: hostname,
          description: "",
          image: parsed.toString(),
          favicon: defaultFavicon,
          siteName: hostname,
          isImage: true,
        };
      }

      const html = (await res.text()).slice(0, 120_000);
      const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
      const title =
        extractMeta(html, ["og:title", "twitter:title"]) ||
        (titleTag ? decodeHtmlEntities(titleTag) : hostname);

      const description =
        extractMeta(html, ["og:description", "twitter:description", "description"]) ||
        "";

      const rawImage = extractMeta(html, [
        "og:image",
        "og:image:secure_url",
        "twitter:image",
        "twitter:image:src",
      ]);
      const image = resolveRelativeUrl(rawImage, parsed.toString());

      const siteName =
        extractMeta(html, ["og:site_name", "application-name"]) || hostname;

      return {
        url: parsed.toString(),
        title: title.slice(0, 180),
        description: description.slice(0, 280),
        image,
        favicon: defaultFavicon,
        siteName: siteName.slice(0, 60),
      };
    } catch {
      return {
        url: parsed.toString(),
        title: hostname,
        description: "",
        image: null,
        favicon: defaultFavicon,
        siteName: hostname,
      };
    }
  });

  return NextResponse.json(data);
}
