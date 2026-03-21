import { supabase } from './supabase'
import type { FeatureKey, PlanStatus } from '@/types'

const PLAN_FEATURES: Record<'free' | 'trial' | 'pro', Record<FeatureKey, boolean>> = {
  free: {
    journal: true,
    ai_journal: false,
    habits: true,
    quests: false,
    ai_quests: false,
    chat: false,
    weekly_insight: false,
    referral: true,
  },
  trial: {
    journal: true,
    ai_journal: true,
    habits: true,
    quests: true,
    ai_quests: true,
    chat: true,
    weekly_insight: true,
    referral: true,
  },
  pro: {
    journal: true,
    ai_journal: true,
    habits: true,
    quests: true,
    ai_quests: true,
    chat: true,
    weekly_insight: true,
    referral: true,
  },
}

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const { data, error } = await supabase
    .from('users')
    .select('plan, trial_end')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return { plan: 'free', isTrialExpired: false, daysLeft: 0, features: PLAN_FEATURES.free }
  }

  const plan = data.plan as 'free' | 'trial' | 'pro'

  if (plan === 'pro') {
    return { plan: 'pro', isTrialExpired: false, daysLeft: 999, features: PLAN_FEATURES.pro }
  }

  if (plan === 'trial' && data.trial_end) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(data.trial_end).getTime() - Date.now()) / 86_400_000),
    )
    const isTrialExpired = daysLeft === 0

    return {
      plan: 'trial',
      isTrialExpired,
      daysLeft,
      features: isTrialExpired ? PLAN_FEATURES.free : PLAN_FEATURES.trial,
    }
  }

  return { plan: 'free', isTrialExpired: false, daysLeft: 0, features: PLAN_FEATURES.free }
}

export async function canUse(userId: string, feature: FeatureKey): Promise<boolean> {
  const status = await getPlanStatus(userId)
  return status.features[feature] ?? false
}

/** Manually upgrade a user to trial (e.g. from a promo flow). */
export async function startTrial(userId: string): Promise<void> {
  const trialEnd = new Date(Date.now() + 5 * 86_400_000).toISOString()
  await supabase
    .from('users')
    .update({ plan: 'trial', trial_end: trialEnd })
    .eq('id', userId)
}
