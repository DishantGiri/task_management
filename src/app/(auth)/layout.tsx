import { Layers } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#635BDB] text-white shadow-subtle">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[18px] font-semibold tracking-tight text-[#20232B]">
              Meridian
            </span>
            <p className="text-[11px] text-[#737987] leading-none mt-0.5">
              Work Management Platform
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
