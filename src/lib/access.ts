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
}

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const { data, error } = await supabase
    .from('users')
    .select('plan, trial_end')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return { plan: 'free', daysLeft: 0, isTrialExpired: false }
  }

  const dbPlan = data.plan as 'free' | 'trial' | 'pro'

  if (dbPlan === 'pro') {
    return { plan: 'pro', daysLeft: 0, isTrialExpired: false }
  }

  if (dbPlan === 'trial' && data.trial_end) {
    const trialEndMs = new Date(data.trial_end).getTime()
    const now = Date.now()
    const daysLeft = Math.max(0, Math.ceil((trialEndMs - now) / 86_400_000))

    if (trialEndMs < now) {
      return { plan: 'free', daysLeft: 0, isTrialExpired: true }
    }

    return { plan: 'trial', daysLeft, isTrialExpired: false }
  }

  return { plan: 'free', daysLeft: 0, isTrialExpired: false }
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
