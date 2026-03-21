import { motion } from 'framer-motion'
import { CheckCircle, Zap, Target } from 'lucide-react'
import type { Quest } from '@/types'
import { SPHERE_COLORS } from '@/types'

interface QuestCardProps {
  quest: Quest
  onComplete?: (id: string) => void
  disabled?: boolean
}

const DIFFICULTY_LABEL: Record<Quest['difficulty'], string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
  epic: 'Эпический',
}

const DIFFICULTY_COLOR: Record<Quest['difficulty'], string> = {
  easy: '#4ade80',
  medium: '#facc15',
  hard: '#f97316',
  epic: '#a855f7',
}

export default function QuestCard({ quest, onComplete, disabled }: QuestCardProps) {
  const sphereColor = SPHERE_COLORS[quest.sphere as keyof typeof SPHERE_COLORS] ?? '#7F77DD'
  const diffColor = DIFFICULTY_COLOR[quest.difficulty]

  return (
    <motion.div
      className="rounded-2xl p-4 border border-white/10"
      style={{ background: `${sphereColor}11` }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${diffColor}22`, color: diffColor }}
            >
              {DIFFICULTY_LABEL[quest.difficulty]}
            </span>
            <span className="text-xs text-gray-400">{quest.sphere}</span>
          </div>
          <h3 className="font-semibold text-white truncate">{quest.title}</h3>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{quest.description}</p>
        </div>

        {onComplete && (
          <motion.button
            onClick={() => !disabled && onComplete(quest.id)}
            disabled={disabled}
            className="flex-shrink-0 p-2 rounded-xl transition-opacity disabled:opacity-40"
            style={{ background: `${sphereColor}22` }}
            whileTap={{ scale: 0.9 }}
          >
            <CheckCircle size={22} style={{ color: sphereColor }} />
          </motion.button>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1 text-accent text-sm font-medium">
          <Zap size={14} />
          <span>+{quest.xp_reward} XP</span>
        </div>
        {quest.deadline && (
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Target size={12} />
            <span>{new Date(quest.deadline).toLocaleDateString('ru')}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
