"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { googleLoginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginCard() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authError = searchParams.get("error");

  useEffect(() => {
    const cleanup = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "lakshya-auth-complete") {
        cleanup();
        popupRef.current?.close();
        popupRef.current = null;
        window.location.href = "/dashboard";
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      cleanup();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);

    // Open Google OAuth in a centered compact popup window
    const width = 480;
    const height = 620;
    const left = Math.max(
      0,
      Math.round(window.screenX + (window.outerWidth - width) / 2)
    );
    const top = Math.max(
      0,
      Math.round(window.screenY + (window.outerHeight - height) / 2)
    );

    const popup = window.open(
      "/google-popup",
      "lakshya-google-auth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes,resizable=yes,scrollbars=yes`
    );

    // Fallback to full-page redirect only if the browser blocked popups
    if (!popup || popup.closed) {
      try {
        await googleLoginAction();
      } catch {
        // NextAuth signIn throws NEXT_REDIRECT which Next.js handles automatically
      }
      return;
    }

    popupRef.current = popup;
    popup.focus();

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    // Detect if user closes the popup manually (or finishes auth without postMessage)
    pollTimerRef.current = setInterval(async () => {
      if (!popupRef.current || popupRef.current.closed) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        popupRef.current = null;
        try {
          const res = await fetch("/api/auth/session", { cache: "no-store" });
          const session = res.ok ? await res.json() : null;
          if (session?.user?.email) {
            window.location.href = "/dashboard";
            return;
          }
        } catch {
          // ignore
        }
        setLoading(false);
      }
    }, 450);
  };

  return (
    <Card className="border-[#EAECF0] shadow-card">
      <CardHeader className="pb-4 text-center">
        <CardTitle className="text-[18px]">
          Sign in to Lakshya Workspace
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
          disabled={loading}
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
          {loading ? "Waiting for Google sign-in..." : "Continue with Google"}
        </Button>

        <div className="rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-3 text-[11.5px] text-[#525866] space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-[#20232B]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#635BDB]" />
            Admin-Controlled Workspace Access
          </div>
          <p className="text-[#737987] leading-relaxed">
            Employees listed in Fishtail HRMS are pre-approved automatically.
            Other first-time Google sign-ins are placed on hold until an admin
            approves access.
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
