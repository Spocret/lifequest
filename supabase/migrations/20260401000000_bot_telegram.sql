-- Telegram bot: settings, sessions, broadcasts, reminders, and dedup tables.
-- Apply in Supabase (SQL editor or CLI) after deploy.

-- 1) User-level notification toggles
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tg_notify_weekly boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tg_notify_degrade boolean NOT NULL DEFAULT true;

-- 2) Simple per-tg_id chat session state (for multi-step admin/user flows)
CREATE TABLE IF NOT EXISTS bot_sessions (
  tg_id bigint PRIMARY KEY,
  mode text NOT NULL DEFAULT 'idle',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_sessions_mode_chk CHECK (mode IN ('idle', 'await_broadcast', 'await_feedback'))
);

-- 3) Broadcast queue (admin-created)
CREATE TABLE IF NOT EXISTS bot_broadcast_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  cursor_created_at timestamptz,
  cursor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_broadcast_jobs_status_chk CHECK (status IN ('pending', 'processing', 'done', 'failed'))
);

CREATE INDEX IF NOT EXISTS bot_broadcast_jobs_status_idx
  ON bot_broadcast_jobs (status)
  WHERE status IN ('pending', 'processing');

-- 4) Dedup: quest notification already sent
CREATE TABLE IF NOT EXISTS bot_quest_notified (
  quest_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Dedup: weekly insight already sent (per user, per week)
CREATE TABLE IF NOT EXISTS bot_weekly_sent (
  user_id uuid NOT NULL,
  week_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_key)
);

-- 6) User reminders (created via bot buttons, fired by cron worker)
CREATE TABLE IF NOT EXISTS bot_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tg_id bigint NOT NULL,
  fire_at timestamptz NOT NULL,
  text text NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_reminders_fire_idx
  ON bot_reminders (fire_at)
  WHERE sent = false;

