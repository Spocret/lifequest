import { createClient } from '@supabase/supabase-js'

type TgSendResult = { ok: boolean; status?: number }

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function getBotToken(): string | null {
  const token = process.env.TG_BOT_TOKEN || process.env.VITE_TG_BOT_TOKEN
  if (!token || token === 'undefined') return null
  return token
}

function getAppUrl(): string {
  const url = process.env.APP_URL || process.env.VITE_APP_URL
  if (!url || url === 'undefined') throw new Error('APP_URL not configured')
  return url.replace(/\/+$/, '')
}

async function sendTg(chatId: number, text: string, withAppButton = false): Promise<TgSendResult> {
  const token = getBotToken()
  if (!token) return { ok: false }
  if (!Number.isFinite(chatId)) return { ok: false }

  const appUrl = withAppButton ? getAppUrl() : null
  const replyMarkup = appUrl
    ? { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: appUrl } }]] }
    : undefined

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false }
  }
}

async function processReminders(nowIso: string): Promise<{ remindersSent: number }> {
  const { data: due } = await supabase
    .from('bot_reminders')
    .select('id, tg_id, text')
    .eq('sent', false)
    .lte('fire_at', nowIso)
    .order('fire_at', { ascending: true })
    .limit(50)

  let remindersSent = 0
  for (const r of due ?? []) {
    const tgId = Number((r as any).tg_id)
    if (!Number.isFinite(tgId)) continue
    const text = String((r as any).text ?? '').slice(0, 3500)
    const res = await sendTg(tgId, text, true)
    if (res.ok) remindersSent++
    await supabase.from('bot_reminders').update({ sent: true }).eq('id', (r as any).id)
  }
  return { remindersSent }
}

async function processQuestNotifications(): Promise<{ questNotified: number }> {
  // Best-effort polling: pick recent quests and dedup via bot_quest_notified.
  const sinceIso = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: quests } = await supabase
    .from('quests')
    .select('id, user_id, title, created_at')
    .gte('created_at', sinceIso)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(50)

  let questNotified = 0
  for (const q of quests ?? []) {
    const questId = (q as any).id
    const { data: already } = await supabase.from('bot_quest_notified').select('quest_id').eq('quest_id', questId).maybeSingle()
    if (already?.quest_id) continue

    const { data: user } = await supabase.from('users').select('tg_id').eq('id', (q as any).user_id).maybeSingle()
    const tgId = Number((user as any)?.tg_id)
    if (!Number.isFinite(tgId)) {
      await supabase.from('bot_quest_notified').insert({ quest_id: questId })
      continue
    }

    const title = String((q as any).title ?? 'Новый квест').slice(0, 200)
    const res = await sendTg(tgId, `Новый квест: ${title}`, true)
    if (res.ok) questNotified++

    await supabase.from('bot_quest_notified').insert({ quest_id: questId })
  }
  return { questNotified }
}

async function processBroadcasts(): Promise<{ broadcastJobsDone: number; broadcastMessagesSent: number }> {
  const appUrl = getAppUrl()
  const { data: job } = await supabase
    .from('bot_broadcast_jobs')
    .select('*')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!job?.id) return { broadcastJobsDone: 0, broadcastMessagesSent: 0 }

  if (job.status === 'pending') {
    await supabase
      .from('bot_broadcast_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id)
  }

  const cursorCreatedAt = job.cursor_created_at as string | null
  const cursorUserId = job.cursor_user_id as string | null

  let q = supabase
    .from('users')
    .select('id, tg_id, created_at')
    .not('tg_id', 'is', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(40)

  if (cursorCreatedAt && cursorUserId) {
    q = q.or(`created_at.gt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.gt.${cursorUserId})`)
  } else if (cursorCreatedAt) {
    q = q.gte('created_at', cursorCreatedAt)
  }

  const { data: users } = await q
  let broadcastMessagesSent = 0

  for (const u of users ?? []) {
    const tgId = Number((u as any).tg_id)
    if (!Number.isFinite(tgId)) continue

    const replyMarkup = { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: appUrl } }]] }
    const token = getBotToken()
    if (!token) break

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          text: String(job.message_text ?? '').slice(0, 3500),
          disable_web_page_preview: true,
          reply_markup: replyMarkup,
        }),
      })
      if (res.ok) broadcastMessagesSent++
    } catch {
      // ignore
    }
  }

  if (!users?.length) {
    await supabase
      .from('bot_broadcast_jobs')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', job.id)
    return { broadcastJobsDone: 1, broadcastMessagesSent }
  }

  const last = users[users.length - 1] as any
  await supabase
    .from('bot_broadcast_jobs')
    .update({
      cursor_created_at: last.created_at ?? null,
      cursor_user_id: last.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  return { broadcastJobsDone: 0, broadcastMessagesSent }
}

/**
 * Vercel cron worker (recommended: every 5 minutes):
 * - reminders
 * - quest notifications (polling)
 * - broadcasts (batched)
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const nowIso = new Date().toISOString()
  const [{ remindersSent }, { questNotified }, { broadcastJobsDone, broadcastMessagesSent }] = await Promise.all([
    processReminders(nowIso),
    processQuestNotifications(),
    processBroadcasts(),
  ])

  return new Response(
    JSON.stringify({
      ok: true,
      remindersSent,
      questNotified,
      broadcastJobsDone,
      broadcastMessagesSent,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

