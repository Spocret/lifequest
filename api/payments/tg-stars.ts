/**
 * Telegram Stars (XTR) — createInvoiceLink + payment webhook handlers.
 *
 * Routes (via vercel.json rewrites → this handler):
 * - POST /api/payments/create-invoice — JWT auth, returns { invoiceUrl }
 * - POST /api/payments/webhook — Telegram updates (also invoked from /api/bot/webhook)
 */
import { createClient } from '@supabase/supabase-js'
import { sendTelegramPlain } from '../bot/send.js'

const MONTH_MS = 30 * 86_400_000

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getBotToken(): string | null {
  const token = process.env.TG_BOT_TOKEN || process.env.VITE_TG_BOT_TOKEN
  if (!token || token === 'undefined') return null
  return token
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
}

function getSupabaseService(): ReturnType<typeof createClient> | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function answerPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string): Promise<void> {
  const token = getBotToken()
  if (!token) throw new Error('TG_BOT_TOKEN not configured')
  const res = await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      ...(ok ? {} : { error_message: (errorMessage ?? 'Недоступно').slice(0, 200) }),
    }),
  })
  if (!res.ok) {
    const details = await res.text().catch(() => '')
    throw new Error(`answerPreCheckoutQuery failed (${res.status}): ${details}`)
  }
}

async function extendProForUser(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: row, error: selErr } = await supabase.from('users').select('pro_until').eq('id', userId).single()
  if (selErr) throw selErr

  const now = Date.now()
  const raw = row?.pro_until as string | null | undefined
  const currentEnd = raw ? new Date(raw).getTime() : null
  const base = currentEnd !== null && currentEnd > now ? currentEnd : now
  const until = new Date(base + MONTH_MS).toISOString()

  const { error: upErr } = await supabase.from('users').update({ plan: 'pro', pro_until: until }).eq('id', userId)
  if (upErr) throw upErr
  return until
}

/**
 * Handles pre_checkout_query and successful_payment. Returns null if this update is unrelated.
 * Call from /api/bot/webhook so Stars payments work with a single Telegram webhook URL.
 */
export async function handlePaymentsTelegramUpdate(update: unknown): Promise<Response | null> {
  const u = update as Record<string, unknown>

  const pcq = u.pre_checkout_query as
    | { id?: string; from?: { id?: number }; invoice_payload?: string }
    | undefined
  if (pcq?.id && pcq.from?.id != null && typeof pcq.invoice_payload === 'string') {
    const supabase = getSupabaseService()
    if (!supabase) {
      await answerPreCheckoutQuery(pcq.id, false, 'Сервер не настроен')
      return jsonResponse({ ok: true }, { status: 200 })
    }

    const payload = pcq.invoice_payload.trim()
    if (!UUID_RE.test(payload)) {
      await answerPreCheckoutQuery(pcq.id, false, 'Неверный счёт')
      return jsonResponse({ ok: true }, { status: 200 })
    }

    const { data: userRow, error } = await supabase.from('users').select('tg_id').eq('id', payload).maybeSingle()
    if (error || !userRow) {
      await answerPreCheckoutQuery(pcq.id, false, 'Пользователь не найден')
      return jsonResponse({ ok: true }, { status: 200 })
    }

    const expectedTg = Number((userRow as { tg_id?: number }).tg_id)
    if (!Number.isFinite(expectedTg) || expectedTg !== pcq.from.id) {
      await answerPreCheckoutQuery(pcq.id, false, 'Не тот аккаунт')
      return jsonResponse({ ok: true }, { status: 200 })
    }

    await answerPreCheckoutQuery(pcq.id, true)
    return jsonResponse({ ok: true }, { status: 200 })
  }

  const msg = u.message as
    | {
        from?: { id?: number }
        chat?: { id?: number }
        successful_payment?: { invoice_payload?: string; currency?: string; total_amount?: number }
      }
    | undefined
  const sp = msg?.successful_payment
  if (sp && msg?.from?.id != null && typeof sp.invoice_payload === 'string') {
    const supabase = getSupabaseService()
    if (!supabase) {
      return jsonResponse({ ok: true }, { status: 200 })
    }

    const payload = sp.invoice_payload.trim()
    if (!UUID_RE.test(payload)) {
      return jsonResponse({ ok: true }, { status: 200 })
    }

    const tgFrom = msg.from.id
    const { data: userRow, error } = await supabase.from('users').select('tg_id').eq('id', payload).maybeSingle()
    if (error || !userRow) {
      return jsonResponse({ ok: true }, { status: 200 })
    }

    const expectedTg = Number((userRow as { tg_id?: number }).tg_id)
    if (!Number.isFinite(expectedTg) || expectedTg !== tgFrom) {
      return jsonResponse({ ok: true }, { status: 200 })
    }

    try {
      await extendProForUser(supabase, payload)
    } catch (e) {
      console.error('[tg-stars successful_payment]', e)
      return jsonResponse({ ok: true }, { status: 200 })
    }

    const chatId = typeof msg.chat?.id === 'number' ? msg.chat.id : tgFrom
    await sendTelegramPlain(chatId, '✦ Добро пожаловать в Pro! Путь продолжается.')
    return jsonResponse({ ok: true }, { status: 200 })
  }

  return null
}

async function handleCreateInvoice(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const auth = req.headers.get('authorization')
  const token = auth?.replace(/^Bearer\s+/i, '')?.trim()
  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseService()
  if (!supabase) {
    return jsonResponse({ error: 'Server misconfigured' }, { status: 500 })
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token)
  if (authErr || !user?.id) {
    return jsonResponse({ error: 'Invalid session' }, { status: 401 })
  }

  const botToken = getBotToken()
  if (!botToken) {
    return jsonResponse({ error: 'Bot token not configured' }, { status: 500 })
  }

  const userId = user.id
  // XTR (Stars): omit provider_token — empty string breaks validation (Bot API payments-stars).
  const body: Record<string, unknown> = {
    title: 'LifeQuest Pro',
    description: 'Безлимитные записи + AI-чат + инсайты',
    payload: userId,
    currency: 'XTR',
    prices: [{ label: '1 месяц', amount: 500 }],
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: string; description?: string }
  if (!res.ok || !data.ok || typeof data.result !== 'string') {
    console.error('[createInvoiceLink]', res.status, data)
    return jsonResponse(
      { error: data.description ?? 'createInvoiceLink failed' },
      { status: res.ok ? 500 : res.status },
    )
  }

  return jsonResponse({ invoiceUrl: data.result })
}

async function handlePaymentsWebhook(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let update: unknown
  try {
    update = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400 })
  }

  const handled = await handlePaymentsTelegramUpdate(update)
  if (handled) return handled
  return jsonResponse({ ok: true }, { status: 200 })
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const action = url.searchParams.get('__action')

  if (action === 'create-invoice' || url.pathname.endsWith('/create-invoice')) {
    return handleCreateInvoice(req)
  }
  if (action === 'webhook' || url.pathname.endsWith('/webhook')) {
    return handlePaymentsWebhook(req)
  }

  return new Response('Not found', { status: 404 })
}
