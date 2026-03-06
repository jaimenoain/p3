-- Enforce tenant-aware RLS on scenarios.
-- A user can only SELECT, INSERT, UPDATE, or DELETE a scenario
-- if its workspace_id belongs to an organization where the user
-- is an active member in organization_members.

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow org members to select scenarios" ON public.scenarios;
CREATE POLICY "Allow org members to select scenarios"
  ON public.scenarios
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id
      FROM public.workspaces w
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow org members to insert scenarios" ON public.scenarios;
CREATE POLICY "Allow org members to insert scenarios"
  ON public.scenarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT w.id
      FROM public.workspaces w
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow org members to update scenarios" ON public.scenarios;
CREATE POLICY "Allow org members to update scenarios"
  ON public.scenarios
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id
      FROM public.workspaces w
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT w.id
      FROM public.workspaces w
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow org members to delete scenarios" ON public.scenarios;
CREATE POLICY "Allow org members to delete scenarios"
  ON public.scenarios
  FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id
      FROM public.workspaces w
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

