import { motion } from 'framer-motion'
import { useXPProgress } from '@/hooks/useLifeQuest'
import { levelRankName } from '@/lib/levelRanks'

interface XPBarProps {
  xp: number
  level: number
  showLabels?: boolean
  className?: string
}

export default function XPBar({ xp, level, showLabels = true, className = '' }: XPBarProps) {
  const { progress, xpToNext, nextThreshold } = useXPProgress(xp, level)

  return (
    <div className={`w-full ${className}`}>
      {showLabels && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>
            {levelRankName(level)} · ур. {level}
          </span>
          <span>{xpToNext} XP до следующего</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #534AB7, #7F77DD)' }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {showLabels && (
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{xp} XP</span>
          <span>{nextThreshold} XP</span>
        </div>
      )}
    </div>
  )
}
