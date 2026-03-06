-- Add a human-readable title to blocks so they can be
-- easily identified on the Canvas and in dependency selectors.

ALTER TABLE public.blocks
ADD COLUMN IF NOT EXISTS title TEXT;

-- Backfill existing rows with a sensible default based on type.
UPDATE public.blocks
SET title = COALESCE(title, type);

