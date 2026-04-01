import { createClient } from '@supabase/supabase-js'

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

function moscowWeekKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  const utc = Date.UTC(y, m - 1, day)
  return `${y}-W${String(getIsoWeek(new Date(utc))).padStart(2, '0')}`
}

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - y.getTime()) / 86_400_000 + 1) / 7)
}

async function sendTg(chatId: number, text: string): Promise<boolean> {
  const token = getBotToken()
  if (!token) return false
  if (!Number.isFinite(chatId)) return false

  const appUrl = getAppUrl()
  const replyMarkup = { inline_keyboard: [[{ text: 'Открыть приложение', url: appUrl }]] }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

function buildInsightText(name: string | null, stats: { mind: number; body: number; spirit: number; resource: number }): string {
  const title = name ? `Недельный инсайт, ${name}` : 'Недельный инсайт'
  const top = Object.entries(stats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mind'
  const topRu = top === 'mind' ? 'Разум' : top === 'body' ? 'Тело' : top === 'spirit' ? 'Дух' : 'Ресурс'
  return (
    `${title}\n\n` +
    `Твоя сильная сторона сейчас: ${topRu}.\n` +
    `Микро-задача на неделю: сделай 1 маленький шаг в этой сфере.\n\n` +
    `Статы: Разум ${stats.mind}, Тело ${stats.body}, Дух ${stats.spirit}, Ресурс ${stats.resource}`
  )
}

/**
 * Vercel cron: weekly (Sunday ~10:00 MSK => 07:00 UTC).
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const weekKey = moscowWeekKey(new Date())

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, tg_id, tg_notify_weekly')
    .not('tg_id', 'is', null)

  if (uErr) return new Response(JSON.stringify({ error: uErr.message }), { status: 500 })

  const { data: chars } = await supabase
    .from('characters')
    .select('user_id, name, mind, body, spirit, resource')

  const charByUser = new Map<string, any>()
  for (const c of chars ?? []) {
    if (c?.user_id) charByUser.set(String(c.user_id), c)
  }

  let sent = 0
  let skipped = 0

  for (const u of users ?? []) {
    if ((u as any).tg_notify_weekly === false) {
      skipped++
      continue
    }

    const userId = String((u as any).id)
    const tgId = Number((u as any).tg_id)
    if (!Number.isFinite(tgId)) continue

    const { data: already } = await supabase
      .from('bot_weekly_sent')
      .select('user_id')
      .eq('user_id', userId)
      .eq('week_key', weekKey)
      .maybeSingle()
    if (already?.user_id) {
      skipped++
      continue
    }

    const c = charByUser.get(userId)
    const stats = {
      mind: Number(c?.mind ?? 1),
      body: Number(c?.body ?? 1),
      spirit: Number(c?.spirit ?? 1),
      resource: Number(c?.resource ?? 1),
    }

    const text = buildInsightText(c?.name ?? null, stats)
    const ok = await sendTg(tgId, text)
    if (ok) sent++

    await supabase.from('bot_weekly_sent').insert({ user_id: userId, week_key: weekKey })
  }

  return new Response(JSON.stringify({ ok: true, weekKey, sent, skipped }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

