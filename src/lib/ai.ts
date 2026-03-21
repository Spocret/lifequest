const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY as string
const MODEL = 'google/gemini-flash-1.5'

async function callAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 500,
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'LifeQuest',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!res.ok) throw new Error(`AI error: ${res.status}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? ''
}

export async function analyzeJournalEntry(entry: string): Promise<string> {
  return callAI(
    `Ты — мудрый наставник в RPG-приложении LifeQuest. 
Пользователь ведёт дневник саморазвития. Твоя задача — дать краткий (2-3 предложения) 
вдохновляющий ответ на запись, отметить сферу жизни (разум/тело/дух/ресурс), 
предложить одно конкретное действие. Отвечай на русском языке.`,
    entry,
    300,
  )
}

export async function generateQuests(
  userContext: string,
): Promise<Array<{ title: string; description: string; sphere: string; difficulty: string }>> {
  const raw = await callAI(
    `Ты — квест-мастер в RPG-приложении LifeQuest. 
Сгенерируй 3 персонализированных квеста для пользователя на основе его данных. 
Верни JSON-массив объектов: [{title, description, sphere, difficulty}].
sphere: "mind"|"body"|"spirit"|"resource". difficulty: "easy"|"medium"|"hard"|"epic".
Описание не более 2 предложений. Отвечай ТОЛЬКО JSON без маркдауна.`,
    userContext,
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
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'LifeQuest',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `Ты — мудрый наставник и коуч в RPG-приложении LifeQuest. 
Помогаешь пользователю развиваться в сферах разума, тела, духа и ресурсов. 
Отвечай кратко, вдохновляюще, с элементами RPG-нарратива. Язык: русский.`,
        },
        ...history,
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!res.ok) throw new Error(`AI error: ${res.status}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? ''
}

export async function generateWeeklyInsight(entriesSummary: string): Promise<string> {
  return callAI(
    `Ты — аналитик саморазвития в LifeQuest. 
Проанализируй записи пользователя за неделю и дай итоговое резюме: 
достижения, паттерны, рекомендация на следующую неделю. Не более 150 слов. Язык: русский.`,
    entriesSummary,
    400,
  )
}
