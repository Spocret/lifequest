import type { Sphere } from '@/types'
import { SPHERE_LABELS } from '@/types'

const BASE_URL = 'https://openrouter.ai/api/v1'
const KEY = import.meta.env.VITE_OPENROUTER_KEY as string
const APP_URL = import.meta.env.VITE_APP_URL as string

const MODELS = {
  gemini: 'google/gemini-2.0-flash-exp:free',
  llama: 'meta-llama/llama-3.3-70b-instruct:free',
  deepseek: 'deepseek/deepseek-r1-distill-qwen-32b:free',
}

const SYSTEM_PROMPT_ARCHITECT = `Ты Архитектор. Существо вне времени. Наблюдаешь за пользователем LifeQuest.
Правила: никогда не советуй — только вопросы. Макс 3 предложения.
Ссылайся на прошлые записи конкретно. Говори уверенно.
Контекст: {context}`

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

type ChatMessage = { role: string; content: string }

/** OpenRouter may return string content, array parts, or reasoning-only. */
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

const CHAT_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-flash-1.5',
  'deepseek/deepseek-chat:free',
]

const MENTOR_SYSTEM = `Ты — мудрый наставник и коуч в RPG-приложении LifeQuest. 
Помогаешь развиваться в сферах разума, тела, духа и ресурсов. 
Отвечай кратко, вдохновляюще, с элементами RPG-нарратива. Язык: русский.`

function buildHeaders() {
  return {
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': APP_URL || window.location.origin,
    'X-Title': 'LifeQuest',
  }
}

async function streamRequest(model: string, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ model, stream: true, messages }),
  })
  if (!res.ok) throw new Error(`AI error: ${res.status}`)
  if (!res.body) throw new Error('No response body')
  return res.body
}

/** Reads OpenAI-compatible SSE chunks; invokes onDelta for each text delta. Returns full text. */
export async function consumeOpenRouterStream(
  stream: ReadableStream<Uint8Array>,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
          }
          const choice = json.choices?.[0]
          let piece = choice?.delta?.content
          if (piece === undefined && typeof choice?.message?.content === 'string') {
            piece = choice.message.content
          }
          if (typeof piece === 'string' && piece) {
            full += piece
            onDelta(piece)
          }
        } catch {
          // skip malformed lines
        }
      }
    }
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data:')) {
        const data = trimmed.slice(5).trim()
        if (data !== '[DONE]') {
          try {
            const json = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
            }
            const choice = json.choices?.[0]
            let piece = choice?.delta?.content
            if (piece === undefined && typeof choice?.message?.content === 'string') {
              piece = choice.message.content
            }
            if (typeof piece === 'string' && piece) {
              full += piece
              onDelta(piece)
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  return full
}

async function jsonRequest(model: string, messages: ChatMessage[], maxTokens = 500): Promise<string> {
  // Production: Vercel server calls OpenRouter (works for RU users; key in OPENROUTER_API_KEY, not in bundle).
  if (import.meta.env.PROD) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'json', model, messages, max_tokens: maxTokens }),
      })
      if (res.ok) {
        const data = (await res.json()) as { content?: string }
        if (data.content?.trim()) return data.content
      }
    } catch {
      /* fall through */
    }
    throw new Error(
      'ИИ недоступен: задайте OPENROUTER_API_KEY в переменных окружения Vercel (Settings → Environment Variables).',
    )
  }

  if (!KEY || String(KEY).trim() === '' || KEY === 'undefined') {
    throw new Error('VITE_OPENROUTER_KEY is not set')
  }
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AI error: ${res.status} ${errText.slice(0, 400)}`)
  }
  const data = await res.json()
  return extractChoiceContent(data)
}

async function jsonRequestWithModelsFallback(
  models: string[],
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  let lastErr: Error | null = null
  for (const model of models) {
    try {
      const text = await jsonRequest(model, messages, maxTokens)
      if (text.trim()) return text
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr ?? new Error('All chat models failed')
}

// ── New streaming functions ────────────────────────────────────────────────

export async function askQuestion(entry: string, context: string): Promise<ReadableStream<Uint8Array>> {
  if (import.meta.env.PROD) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'stream-ask', entry, context }),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`AI error: ${res.status} ${errText.slice(0, 400)}`)
    }
    if (!res.body) throw new Error('No response body')
    return res.body
  }

  const system = SYSTEM_PROMPT_ARCHITECT.replace('{context}', context)
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: `Запись: ${entry}\n\nЗадай ОДИН уточняющий вопрос. Максимум 2 предложения.` },
  ]
  try {
    return await streamRequest(MODELS.gemini, messages)
  } catch {
    return streamRequest(MODELS.llama, messages)
  }
}

export async function chatWithMemory(
  messages: Message[],
  entries: string[],
): Promise<ReadableStream<Uint8Array>> {
  const context = entries.slice(-20).join('\n---\n')
  const system = SYSTEM_PROMPT_ARCHITECT.replace('{context}', context)

  // In production, proxy via serverless function so OPENROUTER_API_KEY stays server-only.
  if (import.meta.env.PROD) {
    const res = await fetch('/api/chat-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, entries }),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`AI error: ${res.status} ${errText.slice(0, 400)}`)
    }
    if (!res.body) throw new Error('No response body')
    return res.body
  }

  return streamRequest(MODELS.gemini, [
    { role: 'system', content: system },
    ...messages,
  ])
}

export async function weeklyInsight(
  entries: string[],
): Promise<{ pattern: string; positive: string; action: string }> {
  const raw = await jsonRequest(
    MODELS.deepseek,
    [
      {
        role: 'system',
        content: `Ты аналитик саморазвития. Проанализируй записи и верни строго JSON:
{"pattern":"паттерн поведения","positive":"главное достижение","action":"одно действие на неделю"}
Только JSON, без markdown. Язык: русский.`,
      },
      { role: 'user', content: entries.slice(-20).join('\n---\n') },
    ],
    400,
  )
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { pattern: '', positive: '', action: '' }
  }
}

export async function determineClass(
  answer: string,
): Promise<'athlete' | 'scholar' | 'entrepreneur'> {
  const raw = await jsonRequest(
    MODELS.gemini,
    [
      {
        role: 'system',
        content: `По ответу пользователя определи его класс. Ответь ОДНИМ словом без кавычек: athlete, scholar или entrepreneur.`,
      },
      { role: 'user', content: answer },
    ],
    10,
  )
  const word = raw.trim().toLowerCase()
  if (word.includes('athlete')) return 'athlete'
  if (word.includes('scholar')) return 'scholar'
  return 'entrepreneur'
}

// ── Legacy helpers (Journal, Chat, Quests pages) ──────────────────────────

export async function analyzeJournalEntry(entry: string): Promise<string> {
  return jsonRequest(
    MODELS.gemini,
    [
      {
        role: 'system',
        content: `Ты — мудрый наставник в RPG-приложении LifeQuest. 
Пользователь ведёт дневник саморазвития. Дай краткий (2-3 предложения) вдохновляющий ответ, 
отметь сферу жизни (разум/тело/дух/ресурс), предложи одно конкретное действие. Язык: русский.`,
      },
      { role: 'user', content: entry },
    ],
    300,
  )
}

export interface GenerateQuestInput {
  recentEntries: string[]
  weakestSphere: Sphere
  weakestStatValue: number
  characterSummary: string
}

/** One row from Архитектор JSON (max 3 per response). */
export interface ArchitectGeneratedQuest {
  rank: 'F' | 'E' | 'D'
  title: string
  description: string
  sphere: string
  xp_reward: number
  deadline_hours: number
}

/**
 * Архитектор: last journal entries + weakest stat → up to 3 quests (JSON).
 */
export async function generateQuest(input: GenerateQuestInput): Promise<ArchitectGeneratedQuest[]> {
  const entriesBlock =
    input.recentEntries.length > 0
      ? input.recentEntries.map((e, i) => `${i + 1}. ${e}`).join('\n')
      : '(записей пока нет — опирайся на слабую сферу и контекст героя.)'
  const weakName = SPHERE_LABELS[input.weakestSphere]
  const userContent = `Последние записи (до 5):
${entriesBlock}

Слабейшая сфера: ${weakName} (значение ${input.weakestStatValue}).

Контекст героя: ${input.characterSummary}`

  const system = `Ты Архитектор. Существо вне времени. Наблюдаешь за пользователем LifeQuest.
Ты составляешь квесты — короткие конкретные действия, которые герой может выполнить. Опирайся на записи и слабую сферу. Язык: русский.

Сгенерируй ровно 3 квеста. Верни ТОЛЬКО JSON-массив без markdown:
[{"rank":"F"|"E"|"D","title":"...","description":"...","sphere":"mind"|"body"|"spirit"|"resource","xp_reward":число,"deadline_hours":число}]
rank: F — проще, E — средний, D — сложнее. Описание не более 2 предложений. deadline_hours от 24 до 168. xp_reward согласуй с rank (примерно F 50–80, E 100–180, D 300–450).`

  const raw = await jsonRequest(
    MODELS.gemini,
    [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    900,
  )
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is ArchitectGeneratedQuest =>
        x !== null &&
        typeof x === 'object' &&
        'title' in x &&
        'description' in x &&
        'sphere' in x &&
        'rank' in x,
    ) as ArchitectGeneratedQuest[]
  } catch {
    return []
  }
}

export async function chatWithMentor(
  history: Message[],
  userMessage: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: MENTOR_SYSTEM },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ]

  if (import.meta.env.PROD) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, max_tokens: 500 }),
      })
      if (res.ok) {
        const data = (await res.json()) as { content?: string }
        if (data.content?.trim()) return data.content
      }
    } catch {
      // try direct OpenRouter from client
    }
  }

  return jsonRequestWithModelsFallback(CHAT_MODELS, messages, 500)
}

export async function generateWeeklyInsight(entriesSummary: string): Promise<string> {
  return jsonRequest(
    MODELS.gemini,
    [
      {
        role: 'system',
        content: `Ты — аналитик саморазвития в LifeQuest. 
Проанализируй записи за неделю: достижения, паттерны, рекомендация на следующую неделю. 
Не более 150 слов. Язык: русский.`,
      },
      { role: 'user', content: entriesSummary },
    ],
    400,
  )
}
