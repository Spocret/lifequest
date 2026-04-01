import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { isAdminUser } from '@/lib/admin'
import type { User } from '@/types'

type Stats = {
  usersTotal: number
  users24h: number
}

export default function Admin({ user }: { user: User }) {
  const allowed = useMemo(() => isAdminUser(user), [user])

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!allowed) return
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    async function load() {
      setLoading(true)
      try {
        const [totalRes, last24hRes] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', since),
        ])

        setStats({
          usersTotal: totalRes.count ?? 0,
          users24h: last24hRes.count ?? 0,
        })
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [allowed])

  if (!allowed) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-dvh bg-background px-4 pt-[calc(var(--app-safe-top,0px)+16px)] pb-24">
      <h1 className="text-white text-2xl font-bold mb-2">Админка</h1>
      <p className="text-gray-400 text-sm mb-6">Доступ только для твоего Telegram аккаунта.</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card border border-white/5 p-4">
          <div className="text-gray-400 text-xs mb-1">Пользователей всего</div>
          <div className="text-white text-2xl font-semibold">
            {loading ? '…' : (stats?.usersTotal ?? '—')}
          </div>
        </div>
        <div className="rounded-2xl bg-card border border-white/5 p-4">
          <div className="text-gray-400 text-xs mb-1">Новых за 24 часа</div>
          <div className="text-white text-2xl font-semibold">
            {loading ? '…' : (stats?.users24h ?? '—')}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-card border border-white/5 p-4">
        <div className="text-white font-semibold mb-1">Уведомления</div>
        <div className="text-gray-400 text-sm">
          Сейчас включены уведомления о новых пользователях. Уведомления о покупках добавим,
          когда появится платёжная интеграция.
        </div>
      </div>
    </div>
  )
}

