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

async function jsonRequest(model: string, messages: ChatMessage[], maxTokens = 500): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) throw new Error(`AI error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ── New streaming functions ────────────────────────────────────────────────

export async function askQuestion(entry: string, context: string): Promise<ReadableStream<Uint8Array>> {
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

export async function generateQuests(
  userContext: string,
): Promise<Array<{ title: string; description: string; sphere: string; difficulty: string }>> {
  const raw = await jsonRequest(
    MODELS.gemini,
    [
      {
        role: 'system',
        content: `Ты — квест-мастер в RPG-приложении LifeQuest. 
Сгенерируй 3 персонализированных квеста. Верни JSON-массив: [{title,description,sphere,difficulty}].
sphere: "mind"|"body"|"spirit"|"resource". difficulty: "easy"|"medium"|"hard"|"epic".
Описание не более 2 предложений. Только JSON без markdown.`,
      },
      { role: 'user', content: userContext },
    ],
    600,
  )
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return []
  }
}

export async function chatWithMentor(
  history: Message[],
  userMessage: string,
): Promise<string> {
  return jsonRequest(
    MODELS.gemini,
    [
      {
        role: 'system',
        content: `Ты — мудрый наставник и коуч в RPG-приложении LifeQuest. 
Помогаешь развиваться в сферах разума, тела, духа и ресурсов. 
Отвечай кратко, вдохновляюще, с элементами RPG-нарратива. Язык: русский.`,
      },
      ...history,
      { role: 'user', content: userMessage },
    ],
    500,
  )
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
