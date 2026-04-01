import { createClient } from '@supabase/supabase-js'
import { answerCallbackQuery, sendTelegramMessage, type InlineButton } from './send'

type TgUpdate = {
  message?: {
    text?: string
    chat?: { id?: number }
  }
  callback_query?: {
    id?: string
    data?: string
    message?: { chat?: { id?: number } }
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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function getAdminChatId(): number | null {
  const raw = process.env.ADMIN_TG_CHAT_ID
  if (!raw || raw === 'undefined') return null
  const n = Number(String(raw).trim())
  return Number.isFinite(n) ? n : null
}

function mainMenuButtons(appUrl: string): InlineButton[][] {
  return [
    [{ text: '🗡 Квесты', callback_data: 'menu:quests' }],
    [
      { text: '⏰ Напомнить', callback_data: 'menu:remind' },
      { text: '⚙️ Настройки', callback_data: 'menu:settings' },
    ],
    [
      { text: '👥 Рефералка', callback_data: 'menu:ref' },
      { text: '📝 Фидбек', callback_data: 'menu:feedback' },
    ],
    [{ text: '❓ Помощь', callback_data: 'menu:help' }],
    [{ text: 'Открыть приложение', web_app: { url: appUrl } }],
  ]
}

async function upsertSession(tgId: number, mode: 'idle' | 'await_broadcast' | 'await_feedback'): Promise<void> {
  await supabase.from('bot_sessions').upsert({ tg_id: tgId, mode, updated_at: new Date().toISOString() })
}

async function getSessionMode(tgId: number): Promise<'idle' | 'await_broadcast' | 'await_feedback'> {
  const { data } = await supabase.from('bot_sessions').select('mode').eq('tg_id', tgId).maybeSingle()
  const m = String((data as any)?.mode ?? 'idle')
  return m === 'await_broadcast' || m === 'await_feedback' ? (m as any) : 'idle'
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let update: TgUpdate
  try {
    update = (await req.json()) as TgUpdate
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Callback queries (inline buttons)
  const cbId = update.callback_query?.id
  const cbData = update.callback_query?.data ?? ''
  const cbChatId = update.callback_query?.message?.chat?.id
  if (cbId && typeof cbChatId === 'number') {
    try {
      await answerCallbackQuery(cbId)
    } catch {
      // best-effort
    }
    const appUrl = getAppUrl()

    if (cbData === 'menu:quests') {
      await sendTelegramMessage(cbChatId, 'Открой приложение, чтобы посмотреть квесты.', {
        parseMode: null,
        buttons: [
          [{ text: 'Открыть приложение', web_app: { url: appUrl } }],
          [{ text: '⬅️ Меню', callback_data: 'menu:root' }],
        ],
      })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData === 'menu:remind') {
      await sendTelegramMessage(cbChatId, 'Через сколько напомнить?', {
        parseMode: null,
        buttons: [
          [
            { text: '1 час', callback_data: 'remind:1h' },
            { text: '3 часа', callback_data: 'remind:3h' },
          ],
          [{ text: 'Завтра 10:00 (МСК)', callback_data: 'remind:tomorrow10' }],
          [{ text: '⬅️ Меню', callback_data: 'menu:root' }],
        ],
      })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData.startsWith('remind:')) {
      const { data: user } = await supabase.from('users').select('id').eq('tg_id', cbChatId).maybeSingle()
      if (user?.id) {
        let fireAt = new Date(Date.now() + 60 * 60 * 1000)
        if (cbData === 'remind:3h') fireAt = new Date(Date.now() + 3 * 60 * 60 * 1000)
        if (cbData === 'remind:tomorrow10') {
          const now = new Date()
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          fireAt = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 7, 0, 0))
        }
        await supabase.from('bot_reminders').insert({
          user_id: user.id,
          tg_id: cbChatId,
          fire_at: fireAt.toISOString(),
          text: 'Напоминание: вернись в LifeQuest и сделай шаг.',
        })
      }
      await sendTelegramMessage(cbChatId, 'Ок, поставил напоминание.', {
        parseMode: null,
        buttons: [
          [{ text: 'Открыть приложение', web_app: { url: appUrl } }],
          [{ text: '⬅️ Меню', callback_data: 'menu:root' }],
        ],
      })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData === 'menu:settings') {
      const { data: u } = await supabase
        .from('users')
        .select('tg_notify_weekly, tg_notify_degrade')
        .eq('tg_id', cbChatId)
        .maybeSingle()
      const weeklyOn = (u as any)?.tg_notify_weekly !== false
      const degradeOn = (u as any)?.tg_notify_degrade !== false

      await sendTelegramMessage(cbChatId, 'Настройки уведомлений:', {
        parseMode: null,
        buttons: [
          [{ text: `Недельный инсайт: ${weeklyOn ? 'ON' : 'OFF'}`, callback_data: 'toggle:weekly' }],
          [{ text: `Деградация: ${degradeOn ? 'ON' : 'OFF'}`, callback_data: 'toggle:degrade' }],
          [{ text: '⬅️ Меню', callback_data: 'menu:root' }],
        ],
      })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData === 'toggle:weekly' || cbData === 'toggle:degrade') {
      const key = cbData === 'toggle:weekly' ? 'tg_notify_weekly' : 'tg_notify_degrade'
      const { data: cur } = await supabase.from('users').select(key).eq('tg_id', cbChatId).maybeSingle()
      const current = (cur as any)?.[key] !== false
      await supabase.from('users').update({ [key]: !current }).eq('tg_id', cbChatId)
      await sendTelegramMessage(cbChatId, 'Готово.', {
        parseMode: null,
        buttons: [
          [{ text: '⚙️ Настройки', callback_data: 'menu:settings' }],
          [{ text: '⬅️ Меню', callback_data: 'menu:root' }],
        ],
      })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData === 'menu:ref') {
      const { data: u } = await supabase.from('users').select('ref_code, referral_code').eq('tg_id', cbChatId).maybeSingle()
      const code = String((u as any)?.ref_code ?? (u as any)?.referral_code ?? '')
      const link = code ? `https://t.me/LifeQuestBot?start=${encodeURIComponent(code)}` : ''
      await sendTelegramMessage(cbChatId, link ? `Твоя ссылка:\n${link}` : 'Не нашёл реферальный код. Зайди в приложение и попробуй ещё раз.', {
        parseMode: null,
        buttons: [
          ...(link ? [[{ text: 'Поделиться ссылкой', url: `https://t.me/share/url?url=${encodeURIComponent(link)}` }]] : []),
          [{ text: '⬅️ Меню', callback_data: 'menu:root' }],
        ],
      })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData === 'menu:feedback') {
      await upsertSession(cbChatId, 'await_feedback')
      await sendTelegramMessage(cbChatId, 'Напиши одним сообщением, что улучшить или какой баг нашёл.', {
        parseMode: null,
        buttons: [[{ text: 'Отмена', callback_data: 'feedback:cancel' }]],
      })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData === 'broadcast:cancel') {
      const adminChatId = getAdminChatId()
      if (adminChatId !== null && cbChatId === adminChatId) {
        await upsertSession(cbChatId, 'idle')
        await sendTelegramMessage(cbChatId, 'Отменено.', { parseMode: null })
        return jsonResponse({ ok: true }, { status: 200 })
      }
    }

    if (cbData === 'feedback:cancel') {
      await upsertSession(cbChatId, 'idle')
      await sendTelegramMessage(cbChatId, 'Ок.', { parseMode: null, buttons: mainMenuButtons(appUrl) })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData === 'menu:help') {
      await sendTelegramMessage(
        cbChatId,
        'Команды:\n/start — старт\n/menu — меню\n\nКнопки:\n- Квесты\n- Напоминание\n- Настройки\n- Рефералка\n- Фидбек',
        { parseMode: null, buttons: [[{ text: '⬅️ Меню', callback_data: 'menu:root' }]] },
      )
      return jsonResponse({ ok: true }, { status: 200 })
    }

    if (cbData === 'menu:root') {
      await sendTelegramMessage(cbChatId, 'Меню:', { parseMode: null, buttons: mainMenuButtons(appUrl) })
      return jsonResponse({ ok: true }, { status: 200 })
    }

    await sendTelegramMessage(cbChatId, 'Не понял действие. Открой меню.', { parseMode: null, buttons: mainMenuButtons(appUrl) })
    return jsonResponse({ ok: true }, { status: 200 })
  }

  // Text messages
  const tgId = update.message?.chat?.id
  const text = (update.message?.text ?? '').trim()
  if (typeof tgId !== 'number') return jsonResponse({ ok: true }, { status: 200 })

  const appUrl = getAppUrl()
  const adminChatId = getAdminChatId()

  // Admin broadcast flow
  if (adminChatId !== null && tgId === adminChatId) {
    if (/^\/broadcast(?:@\w+)?$/i.test(text)) {
      await upsertSession(tgId, 'await_broadcast')
      await sendTelegramMessage(tgId, 'Ок. Следующим сообщением пришли текст рассылки.', {
        parseMode: null,
        buttons: [[{ text: 'Отмена', callback_data: 'broadcast:cancel' }]],
      })
      return jsonResponse({ ok: true }, { status: 200 })
    }
    if (/^\/broadcast_cancel(?:@\w+)?$/i.test(text)) {
      await upsertSession(tgId, 'idle')
      await sendTelegramMessage(tgId, 'Отменено.', { parseMode: null })
      return jsonResponse({ ok: true }, { status: 200 })
    }
    const mode = await getSessionMode(tgId)
    if (mode === 'await_broadcast' && text && !text.startsWith('/')) {
      await supabase.from('bot_broadcast_jobs').insert({ message_text: text, status: 'pending' })
      await upsertSession(tgId, 'idle')
      await sendTelegramMessage(tgId, 'Принял. Рассылка начнётся ближайшим запуском воркера.', { parseMode: null })
      return jsonResponse({ ok: true }, { status: 200 })
    }
  }

  // Feedback flow
  const mode = await getSessionMode(tgId)
  if (mode === 'await_feedback' && text && !text.startsWith('/')) {
    await upsertSession(tgId, 'idle')
    if (adminChatId !== null) {
      const msg = `LifeQuest feedback\nfrom: ${tgId}\n\n${text}`
      try {
        await sendTelegramMessage(adminChatId, msg, { parseMode: null })
      } catch {
        // best-effort
      }
    }
    await sendTelegramMessage(tgId, 'Спасибо! Передал.', { parseMode: null, buttons: mainMenuButtons(appUrl) })
    return jsonResponse({ ok: true }, { status: 200 })
  }

  if (/^\/menu(?:@\w+)?$/i.test(text)) {
    await sendTelegramMessage(tgId, 'Меню:', { parseMode: null, buttons: mainMenuButtons(appUrl) })
    return jsonResponse({ ok: true }, { status: 200 })
  }

  if (/^\/start(?:@\w+)?/i.test(text)) {
    const refCode = parseStartRef(text)
    const webAppUrl = refCode ? `${appUrl}?ref=${encodeURIComponent(refCode)}` : appUrl

    const welcomeText = refCode
      ? 'Добро пожаловать в LifeQuest!\n\nЯ сохранил твой реферальный код. Открой приложение — и начнём.'
      : 'Добро пожаловать в LifeQuest!\n\nОткрой приложение или нажми /menu.'

    await sendTelegramMessage(tgId, welcomeText, {
      parseMode: null,
      buttons: [
        [{ text: 'Открыть приложение', web_app: { url: webAppUrl } }],
        [{ text: '📋 Меню', callback_data: 'menu:root' }],
      ],
    })

    if (!refCode) return jsonResponse({ ok: true }, { status: 200 })
    const cookie = `lq_ref=${encodeURIComponent(refCode)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
    return jsonResponse({ ok: true }, { status: 200, headers: { 'Set-Cookie': cookie } })
  }

  await sendTelegramMessage(tgId, 'Нажми /menu или /start.', { parseMode: null })
  return jsonResponse({ ok: true }, { status: 200 })
}

