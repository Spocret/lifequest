-- Add soft-archive and explicit ordering for habits.

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS sort_order integer;

COMMENT ON COLUMN habits.archived_at IS 'Soft-archived habits are hidden by default.';
COMMENT ON COLUMN habits.sort_order IS 'Per-user ordering; lower values come first.';

-- Backfill order for existing rows (stable within user).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at NULLS LAST, id) AS rn
  FROM habits
  WHERE sort_order IS NULL
)
UPDATE habits h
SET sort_order = r.rn
FROM ranked r
WHERE h.id = r.id;

-- Optional: keep common query fast
CREATE INDEX IF NOT EXISTS habits_user_sort_idx ON habits (user_id, sort_order, id);
CREATE INDEX IF NOT EXISTS habits_user_archived_idx ON habits (user_id, archived_at);

