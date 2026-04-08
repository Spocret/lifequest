-- User setting: how many days back habit check-ins are allowed.
-- 0 = only today, 1 = today + yesterday (default), 7 = last week, etc.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS habit_retro_days smallint;

UPDATE users
SET habit_retro_days = 1
WHERE habit_retro_days IS NULL;

ALTER TABLE users
  ALTER COLUMN habit_retro_days SET NOT NULL,
  ALTER COLUMN habit_retro_days SET DEFAULT 1;

COMMENT ON COLUMN users.habit_retro_days IS 'How many days back habit check-ins are allowed (0=today only).';

