-- Pro: подписка по дате окончания (месяц и продления через pro_until)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pro_until timestamptz;

COMMENT ON COLUMN users.pro_until IS 'Окончание оплаченного Pro; plan=pro пока pro_until > now()';
