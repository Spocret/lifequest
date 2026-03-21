# LifeQuest Architecture

## Folder structure
src/lib/        — all external services (supabase, ai, access, referral)
src/pages/      — full page components  
src/components/ — reusable UI components
api/cron/       — Vercel cron jobs (degrade, trial)
api/bot/        — Telegram bot webhook

## Key files
src/lib/ai.ts       — OpenRouter API, all AI functions
src/lib/access.ts   — plan-based feature gating
src/lib/referral.ts — referral system
src/lib/auth.ts     — Telegram WebApp auth

## Database
Supabase PostgreSQL. Tables: users, characters, journal_entries,
habits, habit_logs, quests, weekly_insights, referrals

## Plans
trial (days 1-5) → free (limited) → pro (490 ₽/month)