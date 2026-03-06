import Sidebar from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center px-8 bg-white border-b border-border">
          <span className="text-sm font-medium text-muted-foreground">
            Dashboard
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
