-- Align habit reminders defaults to Hobby Vercel cron (daily at 07:05 UTC).

ALTER TABLE habit_reminders
  ALTER COLUMN fire_hour_utc SET DEFAULT 7;

ALTER TABLE habit_reminders
  ALTER COLUMN fire_minute_utc SET DEFAULT 5;

UPDATE habit_reminders
SET fire_hour_utc = 7,
    fire_minute_utc = 5,
    updated_at = now()
WHERE fire_hour_utc IS DISTINCT FROM 7
   OR fire_minute_utc IS DISTINCT FROM 5;

