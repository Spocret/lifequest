-- Optional: some deployments had habits without created_at; app no longer requires it for ordering.
-- Add if you want timestamps for analytics or future ORDER BY created_at.

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

COMMENT ON COLUMN habits.created_at IS 'When the habit row was created (optional; app sorts by id if missing)';
