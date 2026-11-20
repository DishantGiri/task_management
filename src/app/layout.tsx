import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meridian — Company Work Management",
  description:
    "Modern enterprise work management platform for projects, tasks, personal tasks, subtasks, teams, and delivery insights.",
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
    <html lang="en">
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
