export type InlineButton =
  | { text: string; url: string }
  | { text: string; web_app: { url: string } }

function getBotToken(): string | null {
  const token = process.env.TG_BOT_TOKEN || process.env.VITE_TG_BOT_TOKEN
  if (!token || token === 'undefined') return null
  return token
}

export async function sendTelegramMessage(tgId: number, text: string, buttons?: InlineButton[]): Promise<void> {
  const token = getBotToken()
  if (!token) throw new Error('TG_BOT_TOKEN not configured')

  const replyMarkup =
    buttons && buttons.length
      ? {
          inline_keyboard: buttons.map((b) => [b]),
        }
      : undefined

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: tgId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })

  if (!res.ok) {
    const details = await res.text().catch(() => '')
    throw new Error(`Telegram send failed (${res.status}): ${details}`)
  }
}

