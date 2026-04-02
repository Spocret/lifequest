import { supabase } from './supabase'
import type { ReferralStats } from '@/types'

type MilestoneReward = { days: number; title?: string; artifact?: string }

/** Must match @BotFather username (no @). Same value as TELEGRAM_BOT_USERNAME on the server. */
function telegramBotUsername(): string {
  const raw = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim() || 'LifeQuestRPGbot'
  return raw.replace(/^@/, '')
}
const APPLY_REFERRAL_TRIAL_BONUS_DAYS = 2

const MILESTONES = [
  { n: 1, reward: { days: 3 } },
  { n: 3, reward: { days: 7, title: 'Глашатай' } },
  { n: 5, reward: { days: 14, artifact: 'знак_призывателя' } },
  { n: 10, reward: { days: 30 } },
  { n: 25, reward: { days: 90, title: 'Архитектор гильдии' } },
] as const satisfies ReadonlyArray<{ n: 1 | 3 | 5 | 10 | 25; reward: MilestoneReward }>

function addDays(iso: string | null | undefined, days: number): string {
  const baseMs = iso ? new Date(iso).getTime() : Date.now()
  const next = new Date(baseMs + days * 86_400_000)
  return next.toISOString()
}

export function getMilestoneReward(n: number): MilestoneReward {
  const hit = MILESTONES.find(m => m.n === n)
  return hit ? hit.reward : { days: 0 }
}

export function buildReferralLink(refCode: string): string {
  const bot = telegramBotUsername()
  return `https://t.me/${bot}?start=${encodeURIComponent(refCode)}`
}

export async function createReferralLink(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('ref_code')
    .eq('id', userId)
    .single()

  if (error || !data?.ref_code) return ''
  return buildReferralLink(String(data.ref_code))
}

export async function applyReferral(newUserId: string, refCode: string): Promise<void> {
  const { data: referrer, error } = await supabase
    .from('users')
    .select('id')
    .eq('ref_code', refCode)
    .neq('id', newUserId)
    .maybeSingle()

  if (error || !referrer?.id) return

  // Insert pending referral (should be UNIQUE on referred_id in DB).
  const { error: insertErr } = await supabase.from('referrals').insert({
    referrer_id: referrer.id,
    referred_id: newUserId,
    status: 'pending',
  })

  // Already referred or constraint violation: treat as no-op.
  if (insertErr) return

  const { data: userRow } = await supabase
    .from('users')
    .select('plan, trial_end')
    .eq('id', newUserId)
    .maybeSingle()

  const nextTrialEnd = addDays(userRow?.trial_end ?? null, APPLY_REFERRAL_TRIAL_BONUS_DAYS)
  const nextPlan: 'trial' | undefined = userRow?.plan === 'free' ? 'trial' : undefined

  await supabase
    .from('users')
    .update({
      referred_by: referrer.id,
      trial_end: nextTrialEnd,
      ...(nextPlan ? { plan: nextPlan } : {}),
    })
    .eq('id', newUserId)
}

async function notifyReferrerActivated(referrerId: string, rewardDays: number): Promise<void> {
  try {
    await fetch('/api/bot/referral-activated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrerId, rewardDays }),
    })
  } catch {
    // best-effort
  }
}

export async function activateReferral(referredUserId: string): Promise<void> {
  const { data: referral, error: findErr } = await supabase
    .from('referrals')
    .select('id, referrer_id, status')
    .eq('referred_id', referredUserId)
    .eq('status', 'pending')
    .maybeSingle()

  if (findErr || !referral?.id || !referral?.referrer_id) return

  const { error: updErr } = await supabase
    .from('referrals')
    .update({ status: 'activated', activated_at: new Date().toISOString() })
    .eq('id', referral.id)
    .eq('status', 'pending')

  if (updErr) return

  const { count: activatedCount } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', referral.referrer_id)
    .eq('status', 'activated')

  const n = activatedCount ?? 0
  const reward = getMilestoneReward(n)
  if (!reward.days) return

  const { data: refUser } = await supabase
    .from('users')
    .select('plan, trial_end')
    .eq('id', referral.referrer_id)
    .maybeSingle()

  // Pro is lifetime in current app; extend trial only for free/trial users.
  if (refUser?.plan !== 'pro') {
    const nextTrialEnd = addDays(refUser?.trial_end ?? null, reward.days)
    const nextPlan: 'trial' | undefined = refUser?.plan === 'free' ? 'trial' : undefined

    await supabase
      .from('users')
      .update({
        trial_end: nextTrialEnd,
        ...(nextPlan ? { plan: nextPlan } : {}),
      })
      .eq('id', referral.referrer_id)
  }

  await notifyReferrerActivated(referral.referrer_id, reward.days)
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const [{ data: userRow }, { count: activatedCount }, { count: totalCount }] = await Promise.all([
    supabase.from('users').select('ref_code').eq('id', userId).maybeSingle(),
    supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .eq('status', 'activated'),
    supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId),
  ])

  const activated = activatedCount ?? 0
  const total = totalCount ?? 0
  const daysEarned = MILESTONES.filter(m => m.n <= activated).reduce((sum, m) => sum + m.reward.days, 0)

  const next = MILESTONES.find(m => m.n > activated) ?? null
  const toNext = next ? next.n - activated : 0

  return {
    code: String(userRow?.ref_code ?? ''),
    total,
    activated,
    daysEarned,
    nextMilestone: next
      ? { n: next.n, reward: next.reward, remaining: toNext }
      : null,
    milestones: MILESTONES.map(m => ({
      n: m.n,
      reward: m.reward,
      status: activated >= m.n ? 'reached' : 'upcoming',
    })),
  }
}
