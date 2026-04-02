/**
 * OpenRouter proxy: mentor chat, JSON completions, stream ask (single Hobby-safe function).
 *
 * Body:
 * - { messages, max_tokens? } — ИИ-наставник (default)
 * - { mode: 'json', model, messages, max_tokens? } — дневник, квесты, класс
 * - { mode: 'stream-ask', entry, context } — стрим вопроса Архитектора (онбординг)
 */
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

/** Tried in order until one returns text (free / widely available). */
const CHAT_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-flash-1.5',
  'deepseek/deepseek-chat:free',
]

const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-flash-1.5',
  'deepseek/deepseek-chat:free',
]

const MODEL_PRIMARY = 'google/gemini-2.0-flash-exp:free'
const MODEL_FALLBACK = 'meta-llama/llama-3.3-70b-instruct:free'

const SYSTEM_PROMPT_ARCHITECT = `Ты Архитектор. Существо вне времени. Наблюдаешь за пользователем LifeQuest.
Правила: никогда не советуй — только вопросы. Макс 3 предложения.
Ссылайся на прошлые записи конкретно. Говори уверенно.
Контекст: {context}`

type ChatMessage = { role: string; content: string }

function extractChoiceContent(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const d = data as Record<string, unknown>
  const choice = (d.choices as unknown[])?.[0] as Record<string, unknown> | undefined
  const message = choice?.message as Record<string, unknown> | undefined
  if (!message) return ''
  const c = message.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return c
      .map((part: unknown) => {
        if (typeof part === 'object' && part !== null && 'text' in part) {
          return String((part as { text?: string }).text ?? '')
        }
        return ''
      })
      .join('')
  }
  if (typeof message.reasoning === 'string') return message.reasoning
  return ''
}

function getKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_KEY
  if (!key || key === 'undefined') return null
  return key
}

function referer(): string {
  return process.env.VITE_APP_URL || 'https://lifequest-seven.vercel.app'
}

async function handleMentorChat(
  body: { messages?: unknown; max_tokens?: number },
  key: string,
): Promise<Response> {
  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const maxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : 500
  let lastStatus = 502
  for (const model of CHAT_MODELS) {
    try {
      const res = await fetch(OPENROUTER, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer(),
          'X-Title': 'LifeQuest',
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
      })
      lastStatus = res.status
      if (!res.ok) continue
      const data = await res.json()
      const content = extractChoiceContent(data).trim()
      if (content) {
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch {
      // try next model
    }
  }

  return new Response(JSON.stringify({ error: 'All models failed', status: lastStatus }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleJsonCompletion(
  body: { model?: unknown; messages?: unknown; max_tokens?: unknown },
  key: string,
): Promise<Response> {
  const primaryModel = typeof body.model === 'string' ? body.model.trim() : ''
  const messages = body.messages
  if (!primaryModel || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'model and messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const normalized: ChatMessage[] = messages
    .map((m: unknown) => {
      if (!m || typeof m !== 'object') return null
      const mm = m as Record<string, unknown>
      const role = mm.role
      const content = mm.content
      if (typeof role !== 'string' || typeof content !== 'string') return null
      return { role, content }
    })
    .filter((x): x is ChatMessage => x !== null)

  if (normalized.length === 0) {
    return new Response(JSON.stringify({ error: 'invalid messages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const maxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : 500
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)]

  let lastStatus = 502
  for (const model of modelsToTry) {
    try {
      const res = await fetch(OPENROUTER, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer(),
          'X-Title': 'LifeQuest',
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: normalized }),
      })
      lastStatus = res.status
      if (!res.ok) continue
      const data = await res.json()
      const content = extractChoiceContent(data).trim()
      if (content) {
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch {
      // try next model
    }
  }

  return new Response(JSON.stringify({ error: 'All models failed', status: lastStatus }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleStreamAsk(
  body: { entry?: unknown; context?: unknown },
  key: string,
): Promise<Response> {
  const entry = typeof body.entry === 'string' ? body.entry : ''
  const context = typeof body.context === 'string' ? body.context : ''
  if (!entry.trim()) {
    return new Response(JSON.stringify({ error: 'entry required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const system = SYSTEM_PROMPT_ARCHITECT.replace('{context}', context)
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: `Запись: ${entry}\n\nЗадай ОДИН уточняющий вопрос. Максимум 2 предложения.` },
  ]

  for (const model of [MODEL_PRIMARY, MODEL_FALLBACK]) {
    try {
      const upstream = await fetch(OPENROUTER, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer(),
          'X-Title': 'LifeQuest',
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages,
        }),
      })

      if (!upstream.ok || !upstream.body) continue

      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    } catch {
      // try next model
    }
  }

  return new Response(JSON.stringify({ error: 'Streaming failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const key = getKey()
  if (!key) {
    return new Response(JSON.stringify({ error: 'OpenRouter key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const mode = typeof body.mode === 'string' ? body.mode : null

  if (mode === 'json') {
    return handleJsonCompletion(body, key)
  }
  if (mode === 'stream-ask') {
    return handleStreamAsk(body, key)
  }

  return handleMentorChat(body, key)
}
