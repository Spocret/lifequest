import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function clampMin1(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.floor(n))
}

function computeStage(days: number): 0 | 1 | 2 | 3 | 4 {
  if (days >= 7) return 4
  if (days >= 4) return 3
  if (days >= 2) return 2
  if (days >= 1) return 1
  return 0
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}

function pickRandomDistinct<T>(arr: T[], count: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  while (pool.length && out.length < count) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool[idx] as T)
    pool.splice(idx, 1)
  }
  return out
}

async function sendTg(chatId: number, text: string): Promise<boolean> {
  const botToken = process.env.TG_BOT_TOKEN || process.env.VITE_TG_BOT_TOKEN
  if (!botToken || botToken === 'undefined') return false
  if (!Number.isFinite(chatId)) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

type StatKey = 'mind' | 'body' | 'spirit' | 'resource'

/**
 * Vercel cron: runs daily to apply inactivity degradation.
 * Schedule: vercel.json → "0 9 * * *" (09:00 UTC)
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, tg_id, tg_notify_degrade, plan')

  if (usersErr) {
    return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 })
  }

  const { data: chars, error: charsErr } = await supabase
    .from('characters')
    .select('id, user_id, xp, mind, body, spirit, resource, last_active, degradation_stage')

  if (charsErr) {
    return new Response(JSON.stringify({ error: charsErr.message }), { status: 500 })
  }

  const charByUser = new Map<string, any>()
  for (const c of chars ?? []) {
    if (c?.user_id) charByUser.set(c.user_id, c)
  }

  let processed = 0
  let charactersUpdated = 0
  let questsFrozen = 0
  let questsExpired = 0
  let tgSent = 0

  for (const u of users ?? []) {
    const char = charByUser.get(u.id)
    if (!char?.id || !char?.last_active) continue

    const rawDays = Math.floor((Date.now() - new Date(char.last_active).getTime()) / 86400000)
    const isPro = (u as { plan?: string }).plan === 'pro'
    const days = Math.max(0, rawDays - (isPro ? 1 : 0))
    const targetStage = computeStage(days)
    const currentStage = Number.isFinite(char.degradation_stage) ? (Number(char.degradation_stage) as number) : 0

    // If user returned recently, just reset stage tracking; don't touch quests/stats.
    if (targetStage === 0) {
      if (currentStage !== 0) {
        const { error: stErr } = await supabase
          .from('characters')
          .update({ degradation_stage: 0 })
          .eq('id', char.id)
        if (!stErr) charactersUpdated++
      }
      processed++
      continue
    }

    // Apply each stage transition once (idempotent across daily cron runs).
    const stagesToApply = [1, 2, 3, 4].filter(s => s > currentStage && s <= targetStage)
    if (!stagesToApply.length) {
      processed++
      continue
    }

    let nextXp = Number(char.xp ?? 0)
    let nextStats: Record<StatKey, number> = {
      mind: Number(char.mind ?? 1),
      body: Number(char.body ?? 1),
      spirit: Number(char.spirit ?? 1),
      resource: Number(char.resource ?? 1),
    }

    const notify = (u as any).tg_notify_degrade !== false
    const tgId = Number(u.tg_id)
    const stats: StatKey[] = ['mind', 'body', 'spirit', 'resource']

    for (const stage of stagesToApply) {
      if (stage === 1) {
        // Freeze active quests.
        const { error: qErr } = await supabase
          .from('quests')
          .update({ status: 'frozen' })
          .eq('user_id', u.id)
          .eq('status', 'active')
        if (!qErr) questsFrozen++
      }

      if (stage === 2) {
        // Expire oldest quest and random stat -= 3.
        const { data: oldest, error: oErr } = await supabase
          .from('quests')
          .select('id')
          .eq('user_id', u.id)
          .in('status', ['active', 'frozen'])
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (!oErr && oldest?.id) {
          const { error: expErr } = await supabase
            .from('quests')
            .update({ status: 'expired' })
            .eq('id', oldest.id)
          if (!expErr) questsExpired++
        }

        const k = pickRandom(stats)
        nextStats[k] = clampMin1(nextStats[k] - 3)

        if (notify && Number.isFinite(tgId)) {
          const ok = await sendTg(tgId, 'Тень заметила твоё молчание.')
          if (ok) tgSent++
        }
      }

      if (stage === 3) {
        // xp *= 0.95, two stats -= 5.
        nextXp = nextXp * 0.95
        for (const k of pickRandomDistinct(stats, 2)) {
          nextStats[k] = clampMin1(nextStats[k] - 5)
        }

        if (notify && Number.isFinite(tgId)) {
          const ok = await sendTg(tgId, 'Ты не заходил 4 дня. Что происходит?')
          if (ok) tgSent++
        }
      }

      if (stage === 4) {
        // xp *= 0.90, three stats -= 8.
        nextXp = nextXp * 0.9
        for (const k of pickRandomDistinct(stats, 3)) {
          nextStats[k] = clampMin1(nextStats[k] - 8)
        }

        if (notify && Number.isFinite(tgId)) {
          const ok = await sendTg(tgId, 'Тёмная фаза. Пройди ритуал воскрешения.')
          if (ok) tgSent++
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      xp: clampMin1(nextXp),
      ...nextStats,
      degradation_stage: targetStage,
    }

    const { error: cErr } = await supabase
      .from('characters')
      .update(updatePayload)
      .eq('id', char.id)

    if (!cErr) charactersUpdated++
    processed++
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed,
      charactersUpdated,
      questsFrozen,
      questsExpired,
      tgSent,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
