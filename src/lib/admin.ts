import type { User } from '@/types'

export function getAdminTgId(): number | null {
  const raw = import.meta.env.VITE_ADMIN_TG_ID
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function isAdminUser(user: Pick<User, 'tg_id'> | null | undefined): boolean {
  const adminTgId = getAdminTgId()
  if (!adminTgId || !user) return false
  return user.tg_id === adminTgId
}

