import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canUse, type FeatureKey } from '@/lib/access'

const FEATURE_TITLES: Record<FeatureKey, string> = {
  journal_entry: 'Записи в дневнике',
  journal_ai: 'ИИ-вопрос после записи',
  habit_add: 'Новые привычки',
  ai_chat: 'ИИ-наставник',
  weekly_insight: 'Еженедельный инсайт',
  history: 'Полная история',
}

function LockIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-accent"
      aria-hidden
    >
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  )
}

interface PaywallProps {
  feature: FeatureKey
  userId: string
  children: ReactNode
  /** Applied to the blocked-state panel (e.g. compact header slot). */
  className?: string
}

export default function Paywall({ feature, userId, children, className }: PaywallProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    canUse(userId, feature).then(ok => {
      if (!cancelled) setAllowed(ok)
    })
    return () => {
      cancelled = true
    }
  }, [userId, feature])

  if (allowed === null) {
    return <div className="relative">{children}</div>
  }

  if (allowed) {
    return <>{children}</>
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-3 px-4 py-8 rounded-3xl text-center max-w-sm mx-auto ${className ?? ''}`}
      style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <LockIcon />
      <h2 className="text-lg font-semibold text-white">{FEATURE_TITLES[feature]}</h2>
      <p className="text-sm text-gray-400 italic max-w-xs leading-relaxed">
        Эта часть пути открыта тем кто продолжает
      </p>
      <Link
        to="/upgrade"
        className="mt-2 w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white text-center"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
      >
        ✦ Открыть Pro 490 ₽/мес
      </Link>
    </div>
  )
}
