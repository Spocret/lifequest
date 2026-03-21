/**
 * OpenRouter proxy for ИИ-наставник (no API key in browser bundle when using server-only OPENROUTER_API_KEY).
 */
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

/** Tried in order until one returns text (free / widely available). */
const CHAT_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-flash-1.5',
  'deepseek/deepseek-chat:free',
]

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const key = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_KEY
  if (!key || key === 'undefined') {
    return new Response(JSON.stringify({ error: 'OpenRouter key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { messages?: unknown; max_tokens?: number }
  try {
    body = (await req.json()) as { messages?: unknown; max_tokens?: number }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const maxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : 500
  const referer = process.env.VITE_APP_URL || 'https://lifequest-seven.vercel.app'

  let lastStatus = 502
  for (const model of CHAT_MODELS) {
    try {
      const res = await fetch(OPENROUTER, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer,
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
