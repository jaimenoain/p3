export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
      {children}
    </div>
  );
}
