import { motion } from 'framer-motion'
import type { Character } from '@/types'

interface CharacterAvatarProps {
  character: Character
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = { sm: 48, md: 80, lg: 120 }

const CLASS_COLORS: Record<Character['class'], string> = {
  warrior: '#ef4444',
  mage: '#7F77DD',
  rogue: '#22c55e',
  healer: '#f59e0b',
  athlete: '#22c55e',
  scholar: '#7F77DD',
  entrepreneur: '#2196F3',
}

const CLASS_ICONS: Record<Character['class'], string> = {
  warrior: '⚔️',
  mage: '🔮',
  rogue: '🗡️',
  healer: '✨',
  athlete: '💪',
  scholar: '📖',
  entrepreneur: '💼',
}

export default function CharacterAvatar({ character, size = 'md', className = '' }: CharacterAvatarProps) {
  const px = SIZE_MAP[size]
  const isRevealed = character.avatar_state === 'revealed'
  const color = CLASS_COLORS[character.class]

  return (
    <motion.div
      className={`relative flex items-center justify-center rounded-full ${className}`}
      style={{ width: px, height: px, background: `${color}22`, border: `2px solid ${color}55` }}
      whileHover={{ scale: 1.05 }}
    >
      {isRevealed && character.avatar_url ? (
        <img
          src={character.avatar_url}
          alt={character.name}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center select-none">
          {isRevealed ? (
            <span style={{ fontSize: px * 0.45 }}>{CLASS_ICONS[character.class]}</span>
          ) : (
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex flex-col items-center gap-0.5"
            >
              <div
                className="rounded-full bg-gray-600"
                style={{ width: px * 0.35, height: px * 0.35 }}
              />
              <div
                className="rounded-full bg-gray-700"
                style={{ width: px * 0.55, height: px * 0.3 }}
              />
            </motion.div>
          )}
        </div>
      )}

      <div
        className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-white font-bold"
        style={{
          width: px * 0.32,
          height: px * 0.32,
          background: color,
          fontSize: px * 0.15,
        }}
      >
        {character.level}
      </div>
    </motion.div>
  )
}
