import crypto from 'node:crypto'

type NotifyEvent = 'new_user' | 'purchase'

function verifyTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return false
  params.delete('hash')

  const pairs: string[] = []
  params.sort()
  for (const [k, v] of params.entries()) {
    pairs.push(`${k}=${v}`)
  }
  const dataCheckString = pairs.join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return computed === hash
}

function parseTelegramUser(initData: string): { id: number; username?: string | null; first_name?: string | null; last_name?: string | null } | null {
  const params = new URLSearchParams(initData)
  const userJson = params.get('user')
  if (!userJson) return null
  try {
    const u = JSON.parse(userJson) as { id?: number; username?: string; first_name?: string; last_name?: string }
    if (typeof u?.id !== 'number') return null
    return u
  } catch {
    return null
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const botToken = process.env.TG_BOT_TOKEN || process.env.VITE_TG_BOT_TOKEN
  const adminChatId = process.env.ADMIN_TG_CHAT_ID
  if (!botToken || botToken === 'undefined') {
    return new Response(JSON.stringify({ error: 'TG_BOT_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!adminChatId || adminChatId === 'undefined') {
    return new Response(JSON.stringify({ error: 'ADMIN_TG_CHAT_ID not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { initData?: string; event?: NotifyEvent }
  try {
    body = (await req.json()) as { initData?: string; event?: NotifyEvent }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const initData = body.initData
  const event = body.event
  if (!initData || typeof initData !== 'string') {
    return new Response(JSON.stringify({ error: 'initData required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!event) {
    return new Response(JSON.stringify({ error: 'event required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!verifyTelegramInitData(initData, botToken)) {
    return new Response(JSON.stringify({ error: 'Invalid initData' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tgUser = parseTelegramUser(initData)
  const username = tgUser?.username ? `@${tgUser.username}` : '(no username)'
  const name =
    tgUser?.first_name || tgUser?.last_name
      ? [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ')
      : '(no name)'
  const tgId = tgUser?.id

  let text = ''
  if (event === 'new_user') {
    text = `LifeQuest: новый пользователь\n${name} ${username}\ntg_id: ${tgId ?? 'unknown'}`
  } else if (event === 'purchase') {
    text = `LifeQuest: покупка\n${name} ${username}\ntg_id: ${tgId ?? 'unknown'}`
  } else {
    return new Response(JSON.stringify({ error: 'Unknown event' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: adminChatId,
      text,
      disable_web_page_preview: true,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return new Response(JSON.stringify({ error: 'Telegram send failed', status: res.status, details: errText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

