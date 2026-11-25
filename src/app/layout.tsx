import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServerClockSync } from "@/components/shared/server-clock-sync";
import { ThemeProvider } from "@/components/shared/theme-provider";
import "./globals.css";

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("meridian-theme");var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Lakshya — Plan · Organize · Achieve",
  description:
    "Modern company work management platform for projects, tasks, personal to-dos, notes, teams, and delivery insights.",
  icons: {
    icon: "/logo-icon.png",
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
