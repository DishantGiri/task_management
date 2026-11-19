"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import type { SessionUser } from "@/lib/permissions";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PendingApprovalClient({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  // Auto-poll every 8 seconds so the moment the Admin approves, the user enters /dashboard
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 8000);
    return () => clearInterval(interval);
  }, [router]);

  const handleCheckStatus = () => {
    setChecking(true);
    router.refresh();
    setTimeout(() => setChecking(false), 700);
  };

  const handleLogout = async () => {
    await logoutAction();
    window.location.href = "/login?reauth=1";
  };

  const isDeactivated = user.status === "INACTIVE";

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[440px]">
        <div className="flex items-center justify-center mb-7">
          <img
            src="/logo.png"
            alt="Meridian — Acme Enterprise"
            className="h-12 w-auto object-contain"
          />
        </div>

        <Card className="border-[#EAECF0] shadow-card">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 border border-amber-200 text-[#F59E0B]">
              {isDeactivated ? (
                <ShieldAlert className="h-6 w-6 text-[#EF4444]" />
              ) : (
                <Clock className="h-6 w-6" />
              )}
            </div>
            <CardTitle className="text-[18px]">
              {isDeactivated
                ? "Account Access Deactivated"
                : "Account Pending Admin Approval"}
            </CardTitle>
            <CardDescription className="text-[13px] mt-1">
              {isDeactivated
                ? "Your workspace account has been placed on hold by an administrator."
                : "Your Google sign-in succeeded, and your account is currently on hold awaiting administrator approval and role assignment."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Signed-in Google Profile Card */}
            <div className="flex items-center gap-3 rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-3.5">
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-[#20232B]">
                  {user.name}
                </p>
                <p className="truncate text-xs text-[#737987]">{user.email}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {isDeactivated ? "Inactive" : "On Hold"}
              </span>
            </div>

            {!isDeactivated && (
              <div className="rounded-lg border border-[#EAECF0] bg-white p-3.5 text-xs text-[#525866] space-y-1.5 leading-relaxed">
                <p className="font-semibold text-[#20232B]">
                  What happens next?
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[#737987]">
                  <li>
                    An administrator (
                    <span className="font-medium text-[#20232B]">
                      dishantgiri@fishtailinfosolutions.com
                    </span>
                    ) has been notified of your sign-in.
                  </li>
                  <li>
                    They will assign your role (<strong>Admin</strong>,{" "}
                    <strong>Manager</strong>, or <strong>Employee</strong>) and
                    activate your account.
                  </li>
                  <li>
                    Once approved, this page will automatically redirect you to
                    the dashboard.
                  </li>
                </ol>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                type="button"
                className="flex-1"
                onClick={handleCheckStatus}
                disabled={checking}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`}
                />
                Check Approval Status
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="text-[#525866]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
