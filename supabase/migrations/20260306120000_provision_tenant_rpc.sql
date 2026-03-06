-- Provision tenant via RPC so all inserts run as SECURITY DEFINER and bypass RLS.
-- Caller must be authenticated and new_user_id must equal auth.uid().
CREATE OR REPLACE FUNCTION public.provision_tenant(
  new_user_id UUID,
  org_name TEXT,
  workspace_name TEXT DEFAULT 'Primary Workspace'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  new_workspace_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM new_user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only provision tenant for yourself';
  END IF;

  INSERT INTO public.organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, new_user_id, 'owner');

  INSERT INTO public.workspaces (organization_id, name, starting_cash_balance)
  VALUES (new_org_id, workspace_name, NULL)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.scenarios (workspace_id, name, is_active_baseline, global_assumptions)
  VALUES (new_workspace_id, 'Baseline', true, '{}'::jsonb);
END;
$$;

-- Allow authenticated users to call this function (they can only pass their own user id).
GRANT EXECUTE ON FUNCTION public.provision_tenant(UUID, TEXT, TEXT) TO authenticated;
