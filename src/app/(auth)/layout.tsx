import { Heart } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-between items-center p-4">
      <div className="w-full max-w-[400px] my-auto py-8">
        <div className="flex items-center justify-center mb-7">
          <img
            src="/logo.png"
            alt="Lakshya — Plan · Organize · Achieve"
            className="h-12 w-auto object-contain dark:hidden"
          />
          <img
            src="/logo-dark.png"
            alt="Lakshya — Plan · Organize · Achieve"
            className="hidden h-12 w-auto object-contain dark:block"
          />
        </div>
        {children}
      </div>

      <footer className="w-full max-w-[520px] py-3 text-center text-[11.5px] text-[#737987]">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>
            Powered by{" "}
            <a
              href="https://fishtailinfosolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#20232B] hover:text-[#635BDB] transition-colors underline-offset-2 hover:underline"
            >
              Fishtail Infosolutions
            </a>
          </span>
          <span className="text-[#9CA3AF]">·</span>
          <span className="inline-flex items-center gap-1">
            <Heart
              className="h-3.5 w-3.5 text-[#635BDB] shrink-0"
              aria-hidden="true"
            />
            Crafted with care by{" "}
            <a
              href="https://dishantgiri.com.np"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#20232B] hover:text-[#635BDB] transition-colors underline-offset-2 hover:underline"
            >
              Dishant Giri
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
