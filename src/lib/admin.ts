import type { User } from '@/types'

/** Supabase bigint / JSON may return tg_id as string; Telegram WebApp uses number. */
export function normalizeTgId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function getAdminTgId(): number | null {
  const raw = import.meta.env.VITE_ADMIN_TG_ID
  if (raw === undefined || raw === null || String(raw).trim() === '') return null
  return normalizeTgId(String(raw).trim())
}

export function isAdminUser(user: Pick<User, 'tg_id'> | null | undefined): boolean {
  const adminTgId = getAdminTgId()
  const userTg = normalizeTgId(user?.tg_id)
  if (adminTgId === null || userTg === null) return false
  return userTg === adminTgId
}

