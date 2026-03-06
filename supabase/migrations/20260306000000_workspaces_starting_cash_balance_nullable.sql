-- Allow NULL on starting_cash_balance so onboarding can gate on "not set" and prompt founders to enter it.
-- Run this migration in the Supabase SQL editor or via Supabase CLI.
ALTER TABLE workspaces
  ALTER COLUMN starting_cash_balance DROP NOT NULL,
  ALTER COLUMN starting_cash_balance DROP DEFAULT;
