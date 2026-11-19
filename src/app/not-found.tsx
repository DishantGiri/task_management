import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-4 text-center">
      <img
        src="/logo.png"
        alt="Meridian — Acme Enterprise"
        className="h-11 w-auto object-contain mb-5"
      />
      <h1 className="text-xl font-semibold text-[#20232B]">Page not found</h1>
      <p className="mt-1 max-w-sm text-xs text-[#737987]">
        The page or workspace resource you requested does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-[#635BDB] px-4 text-xs font-medium text-white hover:bg-[#5148C9] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Return to Overview
      </Link>
    </div>
  );
}
