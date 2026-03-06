-- Blocks table for Projection Canvas.
-- Each block belongs to a scenario, which belongs to a workspace,
-- which is owned by an organization behind the tenant firewall.

CREATE TABLE public.blocks (
  id UUID PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocks_type_check CHECK (
    type IN ('Personnel', 'Revenue', 'Marketing', 'OpEx', 'Capital')
  )
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Helper predicate: user must be a member of the organization
-- that owns the workspace that owns the scenario for this block.
--
-- Implemented inline in each policy via an EXISTS subquery so that
-- access is strictly tenant-scoped.

DROP POLICY IF EXISTS "Allow org members to select blocks" ON public.blocks;
CREATE POLICY "Allow org members to select blocks"
  ON public.blocks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scenarios s
      JOIN public.workspaces w
        ON w.id = s.workspace_id
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE s.id = public.blocks.scenario_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow org members to insert blocks" ON public.blocks;
CREATE POLICY "Allow org members to insert blocks"
  ON public.blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.scenarios s
      JOIN public.workspaces w
        ON w.id = s.workspace_id
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE s.id = public.blocks.scenario_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow org members to update blocks" ON public.blocks;
CREATE POLICY "Allow org members to update blocks"
  ON public.blocks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scenarios s
      JOIN public.workspaces w
        ON w.id = s.workspace_id
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE s.id = public.blocks.scenario_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.scenarios s
      JOIN public.workspaces w
        ON w.id = s.workspace_id
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE s.id = public.blocks.scenario_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow org members to delete blocks" ON public.blocks;
CREATE POLICY "Allow org members to delete blocks"
  ON public.blocks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scenarios s
      JOIN public.workspaces w
        ON w.id = s.workspace_id
      JOIN public.organization_members om
        ON om.organization_id = w.organization_id
      WHERE s.id = public.blocks.scenario_id
        AND om.user_id = auth.uid()
    )
  );

