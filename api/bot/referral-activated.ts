import { createClient } from '@supabase/supabase-js'
import { sendTelegramMessage } from './send.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body: { referrerId?: string; rewardDays?: number }
  try {
    body = (await req.json()) as { referrerId?: string; rewardDays?: number }
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const referrerId = body.referrerId
  const rewardDays = Number(body.rewardDays ?? 0)
  if (!referrerId) return json({ error: 'referrerId required' }, { status: 400 })
  if (!Number.isFinite(rewardDays) || rewardDays <= 0) return json({ ok: true }, { status: 200 })

  const { data: referrer, error } = await supabase
    .from('users')
    .select('tg_id')
    .eq('id', referrerId)
    .maybeSingle()

  if (error || !referrer?.tg_id) return json({ ok: true }, { status: 200 })

  const tgId = Number(referrer.tg_id)
  if (!Number.isFinite(tgId)) return json({ ok: true }, { status: 200 })

  const text = `Твой союзник прошёл первый квест! +${rewardDays} дня Pro`
  try {
    await sendTelegramMessage(tgId, text)
  } catch {
    // best-effort
  }

  return json({ ok: true }, { status: 200 })
}

