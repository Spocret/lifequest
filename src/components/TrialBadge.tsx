import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'

interface TrialBadgeProps {
  daysLeft: number
  onClick?: () => void
}

export default function TrialBadge({ daysLeft, onClick }: TrialBadgeProps) {
  const isUrgent = daysLeft <= 1

  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: isUrgent ? '#ef444422' : '#534AB722',
        border: `1px solid ${isUrgent ? '#ef4444' : '#534AB7'}44`,
        color: isUrgent ? '#f87171' : '#7F77DD',
      }}
      animate={isUrgent ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <Clock size={12} />
      <span>
        {daysLeft === 0
          ? 'Пробный период истёк'
          : daysLeft === 1
          ? 'Остался 1 день'
          : `Осталось ${daysLeft} дней`}
      </span>
    </motion.button>
  )
}
