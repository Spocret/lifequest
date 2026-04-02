/**
 * Streaming proxy for onboarding journal question (Архитектор).
 * Browser loads stream from same origin; server calls OpenRouter.
 */
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

const MODEL_PRIMARY = 'google/gemini-2.0-flash-exp:free'
const MODEL_FALLBACK = 'meta-llama/llama-3.3-70b-instruct:free'

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

  let body: { entry?: unknown; context?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

  const referer = process.env.VITE_APP_URL || 'https://lifequest-seven.vercel.app'

  for (const model of [MODEL_PRIMARY, MODEL_FALLBACK]) {
    try {
      const upstream = await fetch(OPENROUTER, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer,
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
