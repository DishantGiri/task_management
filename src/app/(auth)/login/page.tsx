"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Shield, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { loginSchema } from "@/lib/validations";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LoginFormValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@meridian.io", icon: Shield },
  { label: "Manager", email: "sarah@meridian.io", icon: Users },
  { label: "Employee", email: "alex@meridian.io", icon: UserCheck },
];

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    const result = await loginAction(values);
    if (result?.error) {
      setServerError(result.error);
      return;
    }
    toast.success("Signed in successfully");
    router.push("/dashboard");
    router.refresh();
  };

  const fillDemo = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", "Password123!", { shouldValidate: true });
  };

  return (
    <Card className="border-[#EAECF0] shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-[18px]">Sign in to your workspace</CardTitle>
        <CardDescription>
          Enter your company email and password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {serverError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-[11px] text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-[11px] text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign in
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-[#EAECF0]">
          <p className="text-[11px] font-medium text-[#737987] mb-2">
            Quick demo access (Password123!)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="flex flex-col items-center justify-center gap-1 rounded-md border border-[#EAECF0] bg-[#F7F8FA] py-2 px-2 text-[11px] font-medium text-[#20232B] hover:border-[#635BDB]/50 hover:bg-[#F0EFFF] hover:text-[#5148C9] transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-[#737987]" />
                  {acc.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-[#737987]">
          Need an employee account?{" "}
          <Link
            href="/register"
            className="font-medium text-[#635BDB] hover:text-[#5148C9]"
          >
            Create account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
