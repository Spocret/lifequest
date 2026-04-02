# Промпты для доработки LifeQuest по ТЗ (бэклог)

Используй каждый блок как **одно самостоятельное задание** в Cursor: вставь промпт в чат вместе с `@`-ссылками на указанные файлы/папки.

Общий контекст проекта: Telegram Mini App (React + Vite + TypeScript), Supabase, Vercel API routes, OpenRouter, бот Telegram. Структура: [`src/`](../src/), [`api/`](../api/), [`supabase/migrations/`](../supabase/migrations/).

---

## 1. Пятидневный сюжет триала (день 2 — AI-квест, день 4 — превью чата, день 5 — оффер)

**Что не хватает:** Сейчас есть онбординг «одним заходом» и баннер в последний день триала. В ТЗ — события по **календарным дням** trial (0–5): день 2 — персональный квест от ИИ, день 3 — сложнее + Тень, день 4 — один бесплатный вопрос в чат про записи, день 5 — финал и **единственный** показ оффера Pro.

**Промпт для Cursor:**

```
You are working in the LifeQuest repo (Telegram Mini App).

Goal: Implement a trial-day progression system aligned with the product spec:
- Derive "trial day index" (1–5) from user.created_at or trial_start, consistent with trial_end (5-day window).
- Persist which trial-day milestones already fired (DB table or users JSON column) to avoid duplicate prompts.
- Day 2: trigger or surface an AI-generated quest (reuse generateQuest / quests flow) with a distinct copy "scanning" moment if needed.
- Day 4: allow exactly ONE free AI chat question for trial users who don't have Pro (preview of /chat), then lock again — track in DB.
- Day 5: single strong CTA to /upgrade?fromTrial=1 (avoid nagging on other days); optional modal once.

Constraints:
- Match existing patterns: getPlanStatus, canUse, Paywall, Supabase RLS.
- Do not break free/pro/trial logic in access.ts.
- Add a migration if new columns/tables are needed.

Files to inspect first: src/lib/auth.ts (trial dates), src/lib/access.ts, src/App.tsx, src/pages/Dashboard.tsx, src/pages/Onboarding.tsx, src/pages/Chat.tsx, src/pages/Quests.tsx, api/cron/trial.ts.

Deliver: code + brief note in a comment or ARCHITECTURE snippet on how trial day is computed and stored.
```

---

## 2. Рефералы: артефакт на аватаре, зал славы, `bonus_days_earned`

**Что не хватает:** В ТЗ — вехи с артефактом «Знак призывателя», титулы, для 25 рефералов — «имя в зале славы». В коде вехи частично в UI; нет визуала на персонаже и нет учёта `bonus_days_earned` в схеме.

**Промпт для Cursor:**

```
You are working in the LifeQuest repo.

Goal: Extend referral milestones into visible rewards per TZ:
1) Database: add users.bonus_days_earned (int, default 0) OR equivalent; optionally characters.referral_artifact (text nullable) and characters.referral_title (text nullable) updated when milestones hit (see src/lib/referral.ts activateReferral).
2) On milestone activation, increment bonus_days_earned by the granted days; set title/artifact strings when milestone includes them (n=3 title, n=5 artifact, n=25 "hall of fame" flag or separate table hall_of_fame_entries(user_id, display_name, created_at)).
3) UI: CharacterAvatar or Dashboard — small badge/icon when referral_artifact is set (subtle, on-brand purple).
4) Optional page /hall-of-fame or a section in Referral.tsx listing top referrers (read-only, public names from tg_username or character.name).

Constraints: migrations in supabase/migrations/*.sql; update TypeScript types in src/types/index.ts; keep RLS policies in mind (public read for leaderboard may need a view or edge function).

Files: src/lib/referral.ts, src/pages/Referral.tsx, src/components/CharacterAvatar.tsx, src/types/index.ts.
```

---

## 3. Pro: «глубокий» анализ (Claude Haiku / отдельная модель для Pro)

**Что не хватает:** ТЗ п. 5.1 предлагает anthropic/claude-haiku для глубокого Pro-анализа; сейчас в основном free-tier модели.

**Промпт для Cursor:**

```
You are working in the LifeQuest repo.

Goal: Use a stronger model for Pro-only features while keeping free/trial on cheap/free models.
- In src/lib/ai.ts: add a helper pickModel(feature, plan) or pass plan from callers.
- For users with effective plan Pro (use getPlanStatus or pass flag): use env VITE_OPENROUTER_MODEL_PRO or default anthropic/claude-3.5-haiku (or claude-haiku-4-5 per OpenRouter id) for: weekly insight, optional deep journal analysis, or chat — define clearly which endpoints switch (document in code comments).
- Guard: never call paid model if plan is free/trial without explicit product decision; respect existing canUse for weekly_insight and ai_chat.

Environment: document new vars in README or existing docs (e.g. docs/YOOKASSA_SETUP.md pattern).

Files: src/lib/ai.ts, src/lib/access.ts, callers in Journal/NewEntry/Chat/api/cron/weekly-insight.ts as applicable.
```

---

## 4. Фича `history`: paywall и полная история для Pro

**Что не хватает:** Ключ `history` в canUse для Free = false; список в useJournal обрезан 30 днями для Free. Нужен явный продуктовый UX: «старые записи скрыты → Pro» и возможность открыть полную ленту для Pro/trial.

**Промпт для Cursor:**

```
You are working in the LifeQuest repo.

Goal: Align journal history with FeatureKey 'history':
- Free: show only last 30 days of entries (already partially in useJournal); add UI hint "История старше 30 дней — в Pro" with link to /upgrade when user has older data OR always show teaser row.
- Pro/Trial: fetch full history (paginated or limit 200) — adjust useJournal to accept plan or call getPlanStatus inside hook.
- Optionally use canUse(userId, 'history') in Journal.tsx to toggle query range and Paywall overlay for "export" or "full archive" if product wants.

Files: src/hooks/useLifeQuest.ts (useJournal), src/pages/Journal.tsx, src/lib/access.ts, src/components/Paywall.tsx.
```

---

## 5. Supabase Realtime (опционально по ТЗ)

**Что не хватает:** Подписки на изменения таблиц для мгновенного обновления UI без перезагрузки.

**Промпт для Cursor:**

```
You are working in the LifeQuest repo.

Goal: Add optional Supabase Realtime subscriptions where it improves UX:
- Subscribe to postgres_changes on journal_entries, quests, or characters for the current user_id.
- On event, refetch or patch local state (useCharacter, useJournal, useQuests) — avoid duplicate listeners; cleanup on unmount.
- Enable replication for chosen tables in Supabase dashboard (document steps in comment); use existing supabase client from src/lib/supabase.ts.

Scope: start with ONE table (e.g. quests or journal_entries) on Dashboard or Quests page; don't refactor entire app.

Files: src/lib/supabase.ts, src/hooks/useLifeQuest.ts, relevant pages.
```

---

## 6. Telegram: inline-кнопки в уведомлениях (cron / trial / degrade)

**Что не хватает:** Сообщения текстом; удобнее кнопка «Открыть приложение» / «Pro» с web_app или url.

**Промпт для Cursor:**

```
You are working in the LifeQuest repo.

Goal: Enhance Telegram notifications from serverless crons:
- In api/cron/trial.ts and api/cron/degrade.ts (and api/bot/send.ts if shared), use sendMessage with reply_markup.inline_keyboard: button opening Mini App (web_app: { url: APP_URL }) or link to bot start with ref.
- Read APP URL from process.env.VITE_APP_URL or dedicated TELEGRAM_WEBAPP_URL.
- Keep messages short; test payload size limits.

Files: api/cron/trial.ts, api/cron/degrade.ts, api/bot/send.ts. Reference: Telegram Bot API sendMessage, InlineKeyboardMarkup.
```

---

## 7. Дисбаланс: игровой дебафф (сфера отстаёт на 20+ очков)

**Что не хватает:** Сейчас есть информационный баннер на Dashboard. В ТЗ — дебафф «Дисбаланс» и акцент Архитектора на слабой сфере (квесты уже с weakestSphere).

**Промпт для Cursor:**

```
You are working in the LifeQuest repo.

Goal: Implement gameplay "Дисбаланс" when max(stat) - min(stat) >= 20 (mind, body, spirit, resource):
- Option A (soft): apply a visible debuff label on Dashboard + slight quest XP modifier or Architect prompt bias (already weak sphere).
- Option B (mechanical): -X% to XP from habits in strongest sphere until gap < 20, OR cap one stat — product decision.
- Store debuff state on characters if needed (imbalance_active boolean) or compute derived only.
- Ensure cron degrade and balance logic don't conflict.

Files: src/pages/Dashboard.tsx, src/lib/quests.ts, src/hooks/useLifeQuest.ts (gainXP), optionally api/cron/degrade.ts.

Start with computed flag + Architect system prompt injection in generateQuest; add mechanical debuff only if explicitly requested.
```

---

## 8. Тень: визуальный антагонист (иллюстрация / стадии)

**Что не хватает:** Улучшенный текстовый блок и ритуал есть; нет отдельного визуала «Тени» по лору.

**Промпт для Cursor:**

```
You are working in the LifeQuest repo.

Goal: Strengthen "Shadow" antagonist presence in UI per degradation stage (1–4):
- Add stage-specific illustration: SVG components or Lottie placeholder under src/components/shadow/ — dark silhouette, progressive corruption at stage 3–4, no gore; match purple/dark theme (#0a0a14, #534AB7).
- Wire to useDegradationWarning stage or characters.degradation_stage from DB.
- Optional: one-line "voice of doubt" quote per stage from TZ copy.

Files: src/pages/Dashboard.tsx, src/hooks/useLifeQuest.ts, new components under src/components/.

Accessibility: prefer reduced motion respect (framer-motion or CSS).
```

---

## 9. Единственный показ оффера Pro в день 5 (жёсткая логика)

**Что не хватачет:** Баннер при `daysLeft === 1` уже есть; ТЗ требует «единственный показ оффера» в сценарии дня 5 — возможно один модал + не показывать upgrade на других экранах в тот же день.

**Промпт для Cursor:**

```
You are working in the LifeQuest repo.

Goal: Refine day-5 Pro offer UX:
- Define single source of truth: show full-screen or modal offer once when trial enters "last 24h" or "day 5" per your trial-day model; persist in localStorage/sessionStorage + users.trial_offer_shown if must sync across devices.
- Reduce duplicate CTAs: if day-5 modal shown, suppress TrialBadge navigation to upgrade on same session or coordinate with section 1 (trial narrative).

Files: src/pages/Dashboard.tsx, src/pages/Upgrade.tsx, src/components/TrialBadge.tsx, src/lib/access.ts.
```

---

## Как пользоваться файлом

1. Открой нужный пункт.
2. В Cursor: `@docs/TZ_BACKLOG_PROMPTS.md` + `@src/...` и вставь **только блок промпта** из раздела (от `You are working...` до конца ограничений).
3. После выполнения — прогон `npm run build` и ручная проверка в Telegram WebApp.

Дата добавления: по запросу в репозитории lifequest.
