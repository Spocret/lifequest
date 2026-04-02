/**
 * Streaming OpenRouter proxy for Архитектор memory chat.
 *
 * Keeps API key on the server (OPENROUTER_API_KEY).
 * Accepts: { messages: Array<{role, content}>, entries: string[] }
 * Returns: OpenAI-compatible SSE stream.
 */
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

const MODEL = 'google/gemini-2.0-flash-exp:free'

const SYSTEM_PROMPT_ARCHITECT = `Ты Архитектор. Существо вне времени. Наблюдаешь за пользователем LifeQuest.
Правила: никогда не советуй — только вопросы. Макс 3 предложения.
Ссылайся на прошлые записи конкретно. Говори уверенно.
Контекст: {context}`

type ChatMessage = { role: string; content: string }

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

  let body: { messages?: unknown; entries?: unknown }
  try {
    body = (await req.json()) as { messages?: unknown; entries?: unknown }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawMessages = body.messages
  const entries = body.entries

  if (!Array.isArray(rawMessages)) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const messages: ChatMessage[] = rawMessages
    .map((m: unknown) => {
      if (!m || typeof m !== 'object') return null
      const mm = m as Record<string, unknown>
      const role = mm.role
      const content = mm.content
      if (typeof role !== 'string' || typeof content !== 'string') return null
      return { role, content }
    })
    .filter((x): x is ChatMessage => x !== null)

  const context =
    Array.isArray(entries) ? entries.filter((x): x is string => typeof x === 'string').slice(-20).join('\n---\n') : ''

  const system = SYSTEM_PROMPT_ARCHITECT.replace('{context}', context)

  const referer = process.env.VITE_APP_URL || 'https://lifequest-seven.vercel.app'

  const upstream = await fetch(OPENROUTER, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer,
      'X-Title': 'LifeQuest',
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text()
    return new Response(JSON.stringify({ error: 'Upstream failed', status: upstream.status, detail: errText.slice(0, 400) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!upstream.body) {
    return new Response(JSON.stringify({ error: 'No upstream body' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

