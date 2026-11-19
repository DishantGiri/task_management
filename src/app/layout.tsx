import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian — Company Work Management",
  description:
    "Modern enterprise work management platform for projects, tasks, subtasks, teams, and delivery insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans min-h-screen bg-[#F7F8FA] text-[#20232B]">
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#FFFFFF",
                border: "1px solid #EAECF0",
                color: "#20232B",
                fontSize: "13px",
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
