import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServerClockSync } from "@/components/shared/server-clock-sync";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { OfflineMonitor } from "@/components/shared/offline-monitor";
import "./globals.css";

const SITE_URL = "https://lakshya.dailyworkreport.com";

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("meridian-theme");var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Lakshya",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "Lakshya is a company work management platform to plan projects, organize Agile tasks, track Gantt milestones, manage personal to-dos, and collaborate on rich notes.",
  logo: `${SITE_URL}/logo.png`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#1B1E24" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Lakshya",
  title: {
    default: "Lakshya | Plan, Organize, Achieve",
    template: "%s | Lakshya",
  },
  description:
    "Modern company work management platform for projects, Agile tasks, Gantt timelines, personal to-dos, rich notes, teams, and delivery insights.",
  keywords: [
    "Lakshya",
    "work management",
    "project management",
    "task tracking",
    "Kanban board",
    "Gantt chart",
    "team collaboration",
    "notes workspace",
  ],
  authors: [{ name: "Lakshya" }],
  creator: "Lakshya",
  publisher: "Lakshya",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Lakshya",
    title: "Lakshya | Plan, Organize, Achieve",
    description:
      "Modern company work management platform for projects, Agile tasks, Gantt timelines, personal to-dos, rich notes, and team delivery insights.",
    images: [
      {
        url: "/logo.png",
        width: 788,
        height: 184,
        alt: "Lakshya | Plan, Organize, Achieve",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lakshya | Plan, Organize, Achieve",
    description:
      "Modern company work management platform for projects, Agile tasks, Gantt timelines, notes, and team delivery insights.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo-icon.png",
    shortcut: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-screen bg-[#F7F8FA] text-[#20232B]">
        <ServerClockSync serverNowMs={Date.now()} />
        <ThemeProvider>
          <OfflineMonitor />
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  fontSize: "14.5px",
                  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
