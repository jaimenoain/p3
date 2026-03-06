-- Consolidate VariableCost and OneTime into OpEx with expenseType.
-- 1. Migrate existing VariableCost/OneTime blocks to OpEx and set expenseType in payload.
-- 2. Restrict block type CHECK to Personnel, Revenue, Marketing, OpEx, Capital.

UPDATE public.blocks
SET
  type = 'OpEx',
  payload = payload || '{"expenseType": "variable"}'::jsonb
WHERE type = 'VariableCost';

UPDATE public.blocks
SET
  type = 'OpEx',
  payload = payload || '{"expenseType": "one-off"}'::jsonb
WHERE type = 'OneTime';

ALTER TABLE public.blocks
  DROP CONSTRAINT IF EXISTS blocks_type_check;

ALTER TABLE public.blocks
  ADD CONSTRAINT blocks_type_check CHECK (
    type IN (
      'Personnel',
      'Revenue',
      'Marketing',
      'OpEx',
      'Capital'
    )
  );
