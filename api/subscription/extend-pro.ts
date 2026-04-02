/**
 * POST — продлить Pro на N месяцев (30 дн. каждый) после успешной оплаты.
 * Тело: { "userId": "uuid", "months": 1 }
 * Заголовок: Authorization: Bearer <SUBSCRIPTION_WEBHOOK_SECRET>
 */
import { createClient } from '@supabase/supabase-js'

const MONTH_MS = 30 * 86_400_000

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = process.env.SUBSCRIPTION_WEBHOOK_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { userId?: string; months?: number }
  try {
    body = (await req.json()) as { userId?: string; months?: number }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const userId = body.userId as string | undefined
  const months = Number.isFinite(body.months) && body.months! > 0 ? Math.floor(body.months!) : 1

  if (!userId || typeof userId !== 'string') {
    return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 })
  }

  const supabase = createClient(url, key)

  const { data: row, error: selErr } = await supabase.from('users').select('pro_until').eq('id', userId).single()
  if (selErr) {
    return new Response(JSON.stringify({ error: selErr.message }), { status: 500 })
  }

  const now = Date.now()
  const raw = row?.pro_until as string | null | undefined
  const currentEnd = raw ? new Date(raw).getTime() : null
  const base = currentEnd !== null && currentEnd > now ? currentEnd : now
  const until = new Date(base + months * MONTH_MS).toISOString()

  const { error: upErr } = await supabase.from('users').update({ plan: 'pro', pro_until: until }).eq('id', userId)

  if (upErr) {
    return new Response(JSON.stringify({ error: upErr.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, pro_until: until }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
