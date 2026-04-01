import { sendTelegramMessage, type InlineButton } from './send'

type TgUpdate = {
  message?: {
    text?: string
    chat?: { id?: number }
  }
}

function getAppUrl(): string {
  const url = process.env.APP_URL || process.env.VITE_APP_URL
  if (!url || url === 'undefined') throw new Error('APP_URL not configured')
  return url.replace(/\/+$/, '')
}

function parseStartRef(text: string): string | null {
  // "/start ref_xxx" or "/start@BotName ref_xxx"
  const m = text.trim().match(/^\/start(?:@\w+)?(?:\s+([^\s]+))?$/i)
  const param = m?.[1]?.trim()
  if (!param) return null
  if (!param.startsWith('ref_')) return null
  const code = param.slice('ref_'.length)
  return code ? code : null
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let update: TgUpdate
  try {
    update = (await req.json()) as TgUpdate
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tgId = update.message?.chat?.id
  const text = update.message?.text ?? ''
  if (typeof tgId !== 'number') return jsonResponse({ ok: true }, { status: 200 })

  const refCode = text ? parseStartRef(text) : null
  const appUrl = getAppUrl()
  const webAppUrl = refCode ? `${appUrl}?ref=${encodeURIComponent(refCode)}` : appUrl

  const buttons: InlineButton[] = [{ text: '✦ Начать путь', web_app: { url: webAppUrl } }]
  const welcomeText = refCode
    ? 'Добро пожаловать в LifeQuest!\n\nЯ сохранил твой реферальный код — нажми кнопку ниже, чтобы начать.'
    : 'Добро пожаловать в LifeQuest!\n\nНажми кнопку ниже, чтобы открыть приложение и начать путь.'

  await sendTelegramMessage(tgId, welcomeText, buttons)

  if (!refCode) return jsonResponse({ ok: true }, { status: 200 })

  // "Session": store refCode in cookie for the Mini App to pick up later.
  // Max-Age 30 days.
  const cookie = `lq_ref=${encodeURIComponent(refCode)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
  return jsonResponse({ ok: true }, { status: 200, headers: { 'Set-Cookie': cookie } })
}

