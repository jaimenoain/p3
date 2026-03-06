import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/ui/sidebar";
import { DashboardProvisioningGate } from "./dashboard-provisioning-gate";
import { CashBalancePrompt } from "./cash-balance-prompt";

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  organizationName: string;
  startingCashBalance: number | null;
};

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return <DashboardProvisioningGate />;
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", membership.organization_id)
    .single();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, starting_cash_balance")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!organization || !workspace) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <p className="text-sm text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  const workspaceContext: WorkspaceContext = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    organizationName: organization.name,
    startingCashBalance: workspace.starting_cash_balance ?? null,
  };

  const showCashBalancePrompt = workspaceContext.startingCashBalance === null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar workspaceName={workspaceContext.workspaceName} />
      {showCashBalancePrompt && (
        <CashBalancePrompt workspaceId={workspaceContext.workspaceId} />
      )}
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
