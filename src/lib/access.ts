import { supabase } from './supabase'

export type FeatureKey =
  | 'journal_entry'
  | 'habit_add'
  | 'ai_chat'
  | 'weekly_insight'
  | 'history'

export type PlanStatus = {
  plan: 'trial' | 'free' | 'pro'
  daysLeft: number
  isTrialExpired: boolean
  /** ISO дата окончания trial; только при активном plan === 'trial' */
  trialEndsAt?: string | null
  /** ISO окончания оплаченного Pro */
  proEndsAt?: string | null
  /** Дней до конца Pro; null если дата не задана (legacy) или не Pro */
  proDaysLeft?: number | null
}

const MONTH_MS = 30 * 86_400_000

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const { data, error } = await supabase
    .from('users')
    .select('plan, trial_end, pro_until')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return { plan: 'free', daysLeft: 0, isTrialExpired: false, trialEndsAt: null, proEndsAt: null, proDaysLeft: null }
  }

  const dbPlan = data.plan as 'free' | 'trial' | 'pro'
  const now = Date.now()

  if (dbPlan === 'pro') {
    const proRaw = data.pro_until as string | null | undefined
    if (proRaw) {
      const proEndMs = new Date(proRaw).getTime()
      if (proEndMs < now) {
        return { plan: 'free', daysLeft: 0, isTrialExpired: false, trialEndsAt: null, proEndsAt: null, proDaysLeft: null }
      }
      const proDaysLeft = Math.max(0, Math.ceil((proEndMs - now) / 86_400_000))
      return {
        plan: 'pro',
        daysLeft: 0,
        isTrialExpired: false,
        trialEndsAt: null,
        proEndsAt: proRaw,
        proDaysLeft,
      }
    }
    return {
      plan: 'pro',
      daysLeft: 0,
      isTrialExpired: false,
      trialEndsAt: null,
      proEndsAt: null,
      proDaysLeft: null,
    }
  }

  if (dbPlan === 'trial' && data.trial_end) {
    const trialEndMs = new Date(data.trial_end).getTime()
    const daysLeft = Math.max(0, Math.ceil((trialEndMs - now) / 86_400_000))

    if (trialEndMs < now) {
      return { plan: 'free', daysLeft: 0, isTrialExpired: true, trialEndsAt: null, proEndsAt: null, proDaysLeft: null }
    }

    return {
      plan: 'trial',
      daysLeft,
      isTrialExpired: false,
      trialEndsAt: data.trial_end,
      proEndsAt: null,
      proDaysLeft: null,
    }
  }

  return { plan: 'free', daysLeft: 0, isTrialExpired: false, trialEndsAt: null, proEndsAt: null, proDaysLeft: null }
}

/**
 * Продлить Pro на N месяцев (30 дн. каждый). Новый срок считается от max(now, текущий pro_until).
 * В продакшене лучше вызывать `POST /api/subscription/extend-pro` с service role (см. env SUBSCRIPTION_WEBHOOK_SECRET).
 * Эта функция использует anon-клиент — сработает только если RLS разрешает обновление users.
 */
export async function extendProSubscription(userId: string, months = 1): Promise<void> {
  const { data, error } = await supabase.from('users').select('pro_until').eq('id', userId).single()
  if (error) throw error

  const now = Date.now()
  const raw = data?.pro_until as string | null | undefined
  const currentEnd = raw ? new Date(raw).getTime() : null
  const base = currentEnd !== null && currentEnd > now ? currentEnd : now
  const until = new Date(base + months * MONTH_MS).toISOString()

  const { error: upErr } = await supabase.from('users').update({ plan: 'pro', pro_until: until }).eq('id', userId)
  if (upErr) throw upErr
}

async function countJournalEntriesThisMonth(userId: string): Promise<number> {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', start.toISOString())

  if (error) return 0
  return count ?? 0
}

async function countHabits(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('habits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) return 0
  return count ?? 0
}

export async function canUse(userId: string, feature: FeatureKey): Promise<boolean> {
  const status = await getPlanStatus(userId)

  if (status.plan === 'trial' || status.plan === 'pro') {
    return true
  }

  switch (feature) {
    case 'journal_entry':
      return (await countJournalEntriesThisMonth(userId)) < 10
    case 'habit_add':
      return (await countHabits(userId)) < 3
    case 'ai_chat':
    case 'weekly_insight':
    case 'history':
      return false
    default:
      return false
  }
}

/** Manually upgrade a user to trial (e.g. from a promo flow). */
export async function startTrial(userId: string): Promise<void> {
  const trialEnd = new Date(Date.now() + 5 * 86_400_000).toISOString()
  await supabase
    .from('users')
    .update({ plan: 'trial', trial_end: trialEnd })
    .eq('id', userId)
}
