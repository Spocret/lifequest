import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Vercel cron: runs daily to apply stat degradation
 * to users who have been inactive for 2+ days.
 * Schedule: vercel.json → "0 3 * * *"
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()

  const { data: staleChars, error } = await supabase
    .from('characters')
    .select('id, mind, body, spirit, resource, last_active')
    .lt('last_active', twoDaysAgo)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let updated = 0
  for (const char of staleChars ?? []) {
    const daysInactive = Math.floor((Date.now() - new Date(char.last_active).getTime()) / 86400000)
    const penalty = Math.min(daysInactive - 1, 5)
    if (penalty <= 0) continue

    await supabase
      .from('characters')
      .update({
        mind: Math.max(1, char.mind - penalty),
        body: Math.max(1, char.body - penalty),
        spirit: Math.max(1, char.spirit - penalty),
        resource: Math.max(1, char.resource - penalty),
      })
      .eq('id', char.id)

    updated++
  }

  return new Response(JSON.stringify({ ok: true, updated }), { status: 200 })
}
