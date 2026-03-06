-- Domain 3: Financial Actuals & Period (chart_of_accounts, monthly_periods, historical_records).
-- RLS: default deny; access gated by workspace -> organization -> organization_members.
-- Trigger: prevent INSERT/UPDATE/DELETE on historical_records when parent monthly_periods.status = 'Closed'.

-- chart_of_accounts: workspace-scoped account names and categories
CREATE TABLE public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_system_default BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_chart_of_accounts_workspace ON public.chart_of_accounts(workspace_id);

-- monthly_periods: one row per workspace per calendar month
CREATE TABLE public.monthly_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  calendar_month DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft',
  health_score NUMERIC(5, 2),
  ignore_variance BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(workspace_id, calendar_month)
);

CREATE INDEX idx_monthly_periods_workspace ON public.monthly_periods(workspace_id);

-- historical_records: transactions per period; account_id nullable until mapping
CREATE TABLE public.historical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_period_id UUID NOT NULL REFERENCES public.monthly_periods(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.chart_of_accounts(id),
  transaction_date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  description TEXT,
  is_duplicate_quarantined BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_historical_records_monthly_period ON public.historical_records(monthly_period_id);
CREATE INDEX idx_historical_records_account ON public.historical_records(account_id);

-- RLS: chart_of_accounts
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow org members to select chart_of_accounts"
  ON public.chart_of_accounts
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

CREATE POLICY "Allow org members to insert chart_of_accounts"
  ON public.chart_of_accounts
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

CREATE POLICY "Allow org members to update chart_of_accounts"
  ON public.chart_of_accounts
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

CREATE POLICY "Allow org members to delete chart_of_accounts"
  ON public.chart_of_accounts
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

-- RLS: monthly_periods
ALTER TABLE public.monthly_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow org members to select monthly_periods"
  ON public.monthly_periods
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

CREATE POLICY "Allow org members to insert monthly_periods"
  ON public.monthly_periods
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

CREATE POLICY "Allow org members to update monthly_periods"
  ON public.monthly_periods
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

CREATE POLICY "Allow org members to delete monthly_periods"
  ON public.monthly_periods
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

-- RLS: historical_records (gate by period -> workspace -> org member)
ALTER TABLE public.historical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow org members to select historical_records"
  ON public.historical_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.monthly_periods mp
      JOIN public.workspaces w ON w.id = mp.workspace_id
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE mp.id = public.historical_records.monthly_period_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow org members to insert historical_records"
  ON public.historical_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.monthly_periods mp
      JOIN public.workspaces w ON w.id = mp.workspace_id
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE mp.id = public.historical_records.monthly_period_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow org members to update historical_records"
  ON public.historical_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.monthly_periods mp
      JOIN public.workspaces w ON w.id = mp.workspace_id
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE mp.id = public.historical_records.monthly_period_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.monthly_periods mp
      JOIN public.workspaces w ON w.id = mp.workspace_id
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE mp.id = public.historical_records.monthly_period_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow org members to delete historical_records"
  ON public.historical_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.monthly_periods mp
      JOIN public.workspaces w ON w.id = mp.workspace_id
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE mp.id = public.historical_records.monthly_period_id
        AND om.user_id = auth.uid()
    )
  );

-- Trigger: block mutations on historical_records when parent period is Closed.
-- OLD/NEW: INSERT has NEW only; UPDATE has both (use NEW for period id); DELETE has OLD only.
CREATE OR REPLACE FUNCTION public.check_historical_records_period_not_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  period_id_to_check UUID;
  period_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    period_id_to_check := NEW.monthly_period_id;
  ELSIF TG_OP = 'UPDATE' THEN
    period_id_to_check := NEW.monthly_period_id;
  ELSE
    -- DELETE: only OLD is defined
    period_id_to_check := OLD.monthly_period_id;
  END IF;

  SELECT status INTO period_status
  FROM public.monthly_periods
  WHERE id = period_id_to_check;

  IF period_status = 'Closed' THEN
    RAISE EXCEPTION 'Cannot insert, update, or delete historical records when the monthly period is Closed.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_historical_records_mutation_when_closed ON public.historical_records;
CREATE TRIGGER prevent_historical_records_mutation_when_closed
  BEFORE INSERT OR UPDATE OR DELETE ON public.historical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.check_historical_records_period_not_closed();
