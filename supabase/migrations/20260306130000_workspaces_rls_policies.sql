-- Allow org members to SELECT and UPDATE workspaces in their organization.
-- Required for layout to fetch workspace and for updateWorkspaceCashBalanceAction to save starting_cash_balance.

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow org members to select workspaces" ON public.workspaces;
CREATE POLICY "Allow org members to select workspaces"
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow org members to update workspaces" ON public.workspaces;
CREATE POLICY "Allow org members to update workspaces"
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
