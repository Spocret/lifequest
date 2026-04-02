/** PostgREST errors are often plain objects with `.message`, not `instanceof Error`. */
export function supabaseErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return fallback
}
