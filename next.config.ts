import type { NextConfig } from "next";
import dns from "node:dns";
import net from "node:net";
import path from "path";

try {
  dns.setDefaultResultOrder("ipv4first");
  if (typeof net.setDefaultAutoSelectFamily === "function") {
    net.setDefaultAutoSelectFamily(false);
  }
} catch {
  // Ignore
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: [
        "lakshya.dailyworkreport.com",
        "localhost:3000",
        "localhost:3031",
        "209.126.86.149:3031",
      ],
    },
  },
};

export default nextConfig;
