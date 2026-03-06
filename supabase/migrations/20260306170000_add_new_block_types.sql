-- Add new block types: VariableCost (e.g. server costs scaling with customers)
-- and OneTime (e.g. one-off expenses like buying laptops).
-- Safely replace the existing type CHECK constraint.

ALTER TABLE public.blocks
  DROP CONSTRAINT IF EXISTS blocks_type_check;

ALTER TABLE public.blocks
  ADD CONSTRAINT blocks_type_check CHECK (
    type IN (
      'Personnel',
      'Revenue',
      'Marketing',
      'OpEx',
      'Capital',
      'VariableCost',
      'OneTime'
    )
  );
