export type InlineButton =
  | { text: string; url: string }
  | { text: string; web_app: { url: string } }
  | { text: string; callback_data: string }

function getBotToken(): string | null {
  const token = process.env.TG_BOT_TOKEN || process.env.VITE_TG_BOT_TOKEN
  if (!token || token === 'undefined') return null
  return token
}

export type SendTelegramOptions = {
  parseMode?: 'Markdown' | null
  buttons?: InlineButton[] | InlineButton[][]
  disableWebPagePreview?: boolean
}

export async function sendTelegramMessage(tgId: number, text: string, opts?: SendTelegramOptions): Promise<void> {
  const token = getBotToken()
  if (!token) throw new Error('TG_BOT_TOKEN not configured')

  const rows = opts?.buttons
    ? Array.isArray(opts.buttons[0])
      ? (opts.buttons as InlineButton[][])
      : (opts.buttons as InlineButton[]).map((b) => [b])
    : null

  const replyMarkup = rows && rows.length ? { inline_keyboard: rows } : undefined

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: tgId,
      text,
      ...(opts?.parseMode ? { parse_mode: opts.parseMode } : {}),
      disable_web_page_preview: opts?.disableWebPagePreview ?? true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })

  if (!res.ok) {
    const details = await res.text().catch(() => '')
    throw new Error(`Telegram send failed (${res.status}): ${details}`)
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = getBotToken()
  if (!token) throw new Error('TG_BOT_TOKEN not configured')

  const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    }),
  })

  if (!res.ok) {
    const details = await res.text().catch(() => '')
    throw new Error(`Telegram answerCallbackQuery failed (${res.status}): ${details}`)
  }
}

