import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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

/**
 * Vercel cron: runs daily (10:00 UTC) to manage trial lifecycle.
 * - Expire trials: plan='trial' AND trial_end < now()
 * - Expire Pro: plan='pro' AND pro_until < now()
 * - Day-4 reminder: trial_end BETWEEN now+24h AND now+48h AND trial_notified=false
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const in24hIso = new Date(now + 24 * 60 * 60 * 1000).toISOString()
  const in48hIso = new Date(now + 48 * 60 * 60 * 1000).toISOString()

  // 1) Expire trials
  const { data: expiredUsers, error: expiredErr } = await supabase
    .from('users')
    .select('id, tg_id')
    .eq('plan', 'trial')
    .not('trial_end', 'is', null)
    .lt('trial_end', nowIso)

  if (expiredErr) {
    return new Response(JSON.stringify({ error: expiredErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let expired = 0
  let expiredTgSent = 0

  if (expiredUsers?.length) {
    const ids = expiredUsers.map(u => u.id)

    const { error: updateError } = await supabase
      .from('users')
      .update({ plan: 'free' })
      .in('id', ids)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    expired = ids.length

    const text =
      'Испытание завершено. Персонаж и прогресс сохранены.\n' +
      'AI-чат и недельный инсайт теперь в Pro. [Перейти на Pro →]'

    for (const u of expiredUsers) {
      const tgId = Number(u.tg_id)
      if (!Number.isFinite(tgId)) continue
      const ok = await sendTg(tgId, text)
      if (ok) expiredTgSent++
    }
  }

  // 1b) Expire Pro subscriptions (pro_until passed)
  const { data: expiredPro, error: expiredProErr } = await supabase
    .from('users')
    .select('id, tg_id')
    .eq('plan', 'pro')
    .not('pro_until', 'is', null)
    .lt('pro_until', nowIso)

  let proExpired = 0
  let proExpiredTgSent = 0

  if (expiredProErr) {
    return new Response(JSON.stringify({ error: expiredProErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (expiredPro?.length) {
    const proIds = expiredPro.map(u => u.id)
    const { error: proUpErr } = await supabase
      .from('users')
      .update({ plan: 'free', pro_until: null })
      .in('id', proIds)

    if (proUpErr) {
      return new Response(JSON.stringify({ error: proUpErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    proExpired = proIds.length

    const proText =
      'Подписка Pro закончилась. Прогресс сохранён.\n' +
      'Продлить можно в приложении — Профиль → Подписка.'

    for (const u of expiredPro) {
      const tgId = Number(u.tg_id)
      if (!Number.isFinite(tgId)) continue
      const ok = await sendTg(tgId, proText)
      if (ok) proExpiredTgSent++
    }
  }

  // 2) Day-4 reminder (1–2 days before trial_end)
  const { data: remindUsers, error: remindErr } = await supabase
    .from('users')
    .select('id, tg_id')
    .eq('plan', 'trial')
    .not('trial_end', 'is', null)
    .gte('trial_end', in24hIso)
    .lt('trial_end', in48hIso)
    .or('trial_notified.is.null,trial_notified.eq.false')

  if (remindErr) {
    return new Response(JSON.stringify({ error: remindErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let reminded = 0
  let reminderTgSent = 0

  if (remindUsers?.length) {
    const text =
      'Завтра испытание заканчивается. Кое-что станет недоступно.\n' +
      'Реши до конца дня. [Продолжить путь →]'

    for (const u of remindUsers) {
      const tgId = Number(u.tg_id)
      if (!Number.isFinite(tgId)) continue
      const ok = await sendTg(tgId, text)
      if (ok) reminderTgSent++
    }

    const ids = remindUsers.map(u => u.id)
    const { error: markErr } = await supabase
      .from('users')
      .update({ trial_notified: true })
      .in('id', ids)

    if (markErr) {
      return new Response(JSON.stringify({ error: markErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    reminded = ids.length
  }

  return new Response(
    JSON.stringify({
      ok: true,
      expired,
      expiredTgSent,
      proExpired,
      proExpiredTgSent,
      reminded,
      reminderTgSent,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
