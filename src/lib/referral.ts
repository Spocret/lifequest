import { supabase } from './supabase'
import type { ReferralStats } from '@/types'

const BONUS_DAYS_PER_REFERRAL = 3

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const [userRes, referralsRes] = await Promise.all([
    supabase.from('users').select('referral_code').eq('id', userId).single(),
    supabase.from('referrals').select('id').eq('referrer_id', userId),
  ])

  const code = userRes.data?.referral_code ?? ''
  const count = referralsRes.data?.length ?? 0

  return {
    code,
    count,
    bonusDays: count * BONUS_DAYS_PER_REFERRAL,
  }
}

export async function applyReferralCode(
  newUserId: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const { data: referrer, error } = await supabase
    .from('users')
    .select('id')
    .eq('referral_code', code)
    .single()

  if (error || !referrer) return { success: false, error: 'Код не найден' }
  if (referrer.id === newUserId) return { success: false, error: 'Нельзя использовать свой код' }

  const { error: insertError } = await supabase
    .from('referrals')
    .insert({ referrer_id: referrer.id, referred_id: newUserId, bonus_granted: true })

  if (insertError) return { success: false, error: 'Код уже использован' }

  await supabase.from('users').update({ referred_by: code }).eq('id', newUserId)

  return { success: true }
}

export function buildReferralLink(code: string): string {
  const appUrl = import.meta.env.VITE_APP_URL ?? 'https://t.me/your_bot'
  return `${appUrl}?start=${code}`
}
