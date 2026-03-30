import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Activity, Sparkles, Gem, CheckCircle, Zap, Clock } from 'lucide-react'
import type { Quest } from '@/types'
import { SPHERE_COLORS, SPHERE_LABELS, type Sphere } from '@/types'
import { rankFromDifficulty, type QuestRank } from '@/lib/quests'

interface QuestCardProps {
  quest: Quest
  onComplete?: (id: string) => void
  disabled?: boolean
  /** active: countdown + complete; preview: dashboard strip; history: completed list */
  variant?: 'active' | 'preview' | 'history'
}

const SPHERE_ICON: Record<Sphere, typeof Brain> = {
  mind: Brain,
  body: Activity,
  spirit: Sparkles,
  resource: Gem,
}

const RANK_STYLE: Record<QuestRank, { bg: string; text: string; border: string }> = {
  F: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/35' },
  E: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/35' },
  D: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/35' },
  C: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/35' },
}

function useDeadlineCountdown(deadline: string | null, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!deadline || !enabled) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [deadline, enabled])

  if (!deadline) {
    return { expired: false, label: null as string | null }
  }
  const end = new Date(deadline).getTime()
  const ms = end - now
  const expired = ms <= 0
  if (expired) {
    return { expired: true, label: null }
  }
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  let label: string
  if (d > 0) {
    label = `${d}д ${h}ч`
  } else {
    label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return { expired: false, label }
}

export default function QuestCard({ quest, onComplete, disabled, variant = 'active' }: QuestCardProps) {
  const sphere =
    quest.sphere === 'mind' ||
    quest.sphere === 'body' ||
    quest.sphere === 'spirit' ||
    quest.sphere === 'resource'
      ? (quest.sphere as Sphere)
      : 'mind'
  const sphereColor = SPHERE_COLORS[sphere]
  const SphereIc = SPHERE_ICON[sphere] ?? Brain
  const rank = rankFromDifficulty(quest.difficulty)
  const rankStyle = RANK_STYLE[rank]
  const tick = variant === 'active' && !!quest.deadline
  const { expired, label } = useDeadlineCountdown(quest.deadline, tick)

  const showComplete =
    variant === 'active' && onComplete && !expired && !disabled

  const isHistory = variant === 'history'
  const isPreview = variant === 'preview'

  return (
    <motion.div
      className={`rounded-2xl p-4 border ${isHistory ? 'border-white/5 opacity-90' : 'border-white/10'}`}
      style={{ background: `${sphereColor}11` }}
      whileTap={variant === 'active' || isPreview ? { scale: 0.98 } : undefined}
      layout
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${sphereColor}22` }}
          >
            <SphereIc size={20} style={{ color: sphereColor }} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md border ${rankStyle.bg} ${rankStyle.text} ${rankStyle.border}`}
              >
                {rank}
              </span>
              <span className="text-xs text-gray-500">{SPHERE_LABELS[sphere]}</span>
              {expired && variant !== 'history' && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                  Истёк
                </span>
              )}
            </div>
            <h3 className="font-semibold text-white truncate">{quest.title}</h3>
            <p className="text-sm text-gray-400 mt-1 line-clamp-3">{quest.description}</p>
          </div>
        </div>

        {showComplete && (
          <motion.button
            type="button"
            onClick={() => onComplete(quest.id)}
            className="flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: `linear-gradient(135deg, ${sphereColor}99, ${sphereColor}55)` }}
            whileTap={{ scale: 0.95 }}
          >
            Готово
          </motion.button>
        )}

        {isHistory && (
          <div className="flex-shrink-0 p-2 rounded-xl bg-white/5 text-emerald-400">
            <CheckCircle size={22} aria-hidden />
          </div>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-3 mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1 text-accent text-sm font-medium">
          <Zap size={14} />
          <span>+{quest.xp_reward} XP</span>
        </div>
        {quest.deadline && variant !== 'history' && (
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Clock size={12} />
            {expired ? (
              <span>до {new Date(quest.deadline).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            ) : label ? (
              <span>{label}</span>
            ) : (
              <span>{new Date(quest.deadline).toLocaleString('ru', { day: 'numeric', month: 'short' })}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
