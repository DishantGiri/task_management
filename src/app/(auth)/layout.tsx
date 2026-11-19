export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center mb-7">
          <img
            src="/logo.png"
            alt="Meridian — Acme Enterprise"
            className="h-12 w-auto object-contain"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
