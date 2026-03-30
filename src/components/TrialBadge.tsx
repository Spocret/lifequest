import { motion } from 'framer-motion'

interface TrialBadgeProps {
  daysLeft: number
  onClick?: () => void
}

/** Dashboard-style: Pro · Nд — amber when 1 day left, purple otherwise */
export default function TrialBadge({ daysLeft, onClick }: TrialBadgeProps) {
  const isUrgent = daysLeft === 1

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight"
      style={{
        background: isUrgent ? 'rgba(245, 158, 11, 0.15)' : 'rgba(83, 74, 183, 0.2)',
        border: `1px solid ${isUrgent ? 'rgba(245, 158, 11, 0.45)' : 'rgba(127, 119, 221, 0.45)'}`,
        color: isUrgent ? '#fbbf24' : '#a78bfa',
      }}
      animate={isUrgent ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      Pro · {daysLeft}д
    </motion.button>
  )
}
