/** PostgREST errors are often plain objects with `.message`, not `instanceof Error`. */
export function supabaseErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown }
    const m = o.message
    if (typeof m === 'string' && m.length > 0) {
      const bits = [o.details, o.hint].filter((x): x is string => typeof x === 'string' && x.length > 0)
      return bits.length ? `${m} (${bits.join(' — ')})` : m
    }
  }
  return fallback
}
