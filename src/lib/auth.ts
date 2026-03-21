import { supabase } from './supabase'
import { applyReferralCode } from './referral'
import type { User, Character } from '@/types'

const TRIAL_DAYS = 5
const REF_SESSION_KEY = 'lq_ref_code'

export interface AuthResult {
  user: User
  character: Character
  isNewUser: boolean
}

// Deterministic referral code derived from the Telegram user ID.
function generateReferralCode(tgId: number): string {
  return `ref_${tgId.toString(36)}`
}

// Read ?ref= from the current URL, fall back to TG start_param.
function extractRefCode(): string | null {
  const urlRef = new URLSearchParams(window.location.search).get('ref')
  if (urlRef) return urlRef

  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param
  return startParam ?? null
}

export async function initTelegramAuth(): Promise<AuthResult> {
  // ── Step 1: require Telegram context ──────────────────────────
  const tg = window.Telegram?.WebApp

  // Presence of the WebApp object is the reliable signal we're inside a Mini App.
  // On some iOS Telegram versions initData is empty even in a real Mini App context,
  // so we do NOT gate on initData — we only require the WebApp object itself.
  if (!tg) throw new Error('Not in Telegram')

  let tgUser = tg.initDataUnsafe?.user
  if (!tgUser && tg.initData) {
    try {
      const params = new URLSearchParams(tg.initData)
      const userJson = params.get('user')
      if (userJson) tgUser = JSON.parse(userJson)
    } catch {
      // malformed initData — still not a valid Telegram context
    }
  }

  if (!tgUser) throw new Error('Not in Telegram')

  // ── Step 2: save referral code to sessionStorage ───────────────
  const freshRef = extractRefCode()
  if (freshRef) {
    sessionStorage.setItem(REF_SESSION_KEY, freshRef)
  }
  const refCode = freshRef ?? sessionStorage.getItem(REF_SESSION_KEY)

  // ── Step 3: upsert user (insert or update username only) ───────
  const referralCode = generateReferralCode(tgUser.id)
  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()

  // Check for existing user first so we don't overwrite plan/trial_end.
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('tg_id', tgUser.id)
    .maybeSingle()

  let user: User

  if (!existing) {
    // Brand new user — insert with trial.
    const { data, error } = await supabase
      .from('users')
      .insert({
        tg_id: tgUser.id,
        tg_username: tgUser.username ?? null,
        plan: 'trial',
        trial_end: trialEnd,
        referral_code: referralCode,
        referred_by: null,
      })
      .select()
      .single()

    if (error) throw new Error(`User insert failed: ${error.message}`)
    user = data as User
  } else {
    // Existing user — only sync the Telegram username.
    if (existing.tg_username !== (tgUser.username ?? null)) {
      await supabase
        .from('users')
        .update({ tg_username: tgUser.username ?? null })
        .eq('tg_id', tgUser.id)
    }
    user = existing as User
  }

  const isNewUser = !existing

  // ── Step 4: ensure character row exists ────────────────────────
  const { data: existingChar } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  let character: Character

  if (!existingChar) {
    // Create a placeholder — Onboarding will fill in name & class.
    const { data, error } = await supabase
      .from('characters')
      .insert({
        user_id: user.id,
        name: '',
        class: 'warrior',
        avatar_state: 'hidden',
        level: 1,
        xp: 0,
        mind: 10,
        body: 10,
        spirit: 10,
        resource: 10,
        last_active: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw new Error(`Character insert failed: ${error.message}`)
    character = data as Character
  } else {
    character = existingChar as Character
  }

  // ── Step 5: apply referral code for new users ──────────────────
  if (isNewUser && refCode && !user.referred_by) {
    await applyReferralCode(user.id, refCode)
    sessionStorage.removeItem(REF_SESSION_KEY)
  }

  return { user, character, isNewUser }
}
