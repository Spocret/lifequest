-- Дневник: приложение ходит в Supabase с anon-ключом без Supabase Auth JWT
-- (как users / characters). Нужны политики RLS для INSERT/SELECT/UPDATE по user_id,
-- существующему в public.users.

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_entries_insert_anon" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_select_anon" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_update_anon" ON journal_entries;

CREATE POLICY "journal_entries_insert_anon" ON journal_entries
FOR INSERT TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id)
);

CREATE POLICY "journal_entries_select_anon" ON journal_entries
FOR SELECT TO anon
USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id)
);

CREATE POLICY "journal_entries_update_anon" ON journal_entries
FOR UPDATE TO anon
USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id)
);
