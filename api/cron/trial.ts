import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TRIAL_DAYS = 5

/**
 * Vercel cron: runs daily to expire trial plans.
 * Schedule: vercel.json → "0 4 * * *"
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const cutoff = new Date(Date.now() - TRIAL_DAYS * 86400000).toISOString()

  const { data: expiredUsers, error } = await supabase
    .from('users')
    .select('id')
    .eq('plan', 'trial')
    .lt('trial_started_at', cutoff)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!expiredUsers?.length) {
    return new Response(JSON.stringify({ ok: true, expired: 0 }), { status: 200 })
  }

  const ids = expiredUsers.map(u => u.id)

  const { error: updateError } = await supabase
    .from('users')
    .update({ plan: 'free' })
    .in('id', ids)

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, expired: ids.length }), { status: 200 })
}
