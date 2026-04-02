-- Schedule habits on specific weekdays (ISO: 1=Mon … 7=Sun). Legacy rows get all 7 days.

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS weekdays smallint[];

UPDATE habits
SET weekdays = ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]
WHERE weekdays IS NULL;

ALTER TABLE habits
  ALTER COLUMN weekdays SET NOT NULL,
  ALTER COLUMN weekdays SET DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[];

COMMENT ON COLUMN habits.weekdays IS 'Which weekdays the habit is planned: 1=Monday … 7=Sunday';
