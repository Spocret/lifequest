-- Habit-specific reminders sent via Telegram bot cron.

CREATE TABLE IF NOT EXISTS habit_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  habit_id uuid NOT NULL UNIQUE,
  tg_id bigint NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  -- Fire time in UTC (supports simple cron tick). Default: 07:00 UTC (10:00 MSK).
  fire_hour_utc smallint NOT NULL DEFAULT 7,
  fire_minute_utc smallint NOT NULL DEFAULT 0,
  -- Which weekdays (ISO: 1=Mon … 7=Sun). Default: all.
  weekdays smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7]::smallint[],
  -- Dedup: last calendar day (YYYY-MM-DD, UTC) this reminder fired.
  last_fired_ymd text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS habit_reminders_due_idx
  ON habit_reminders (enabled, fire_hour_utc, fire_minute_utc);

COMMENT ON TABLE habit_reminders IS 'Recurring habit reminders delivered by Telegram bot cron.';
COMMENT ON COLUMN habit_reminders.last_fired_ymd IS 'YYYY-MM-DD (UTC) when reminder last fired.';

