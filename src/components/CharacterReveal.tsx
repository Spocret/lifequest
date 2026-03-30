import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { Character } from '@/types'

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

const OVERLAY_MS = 500
const NAV_MS = 3500

interface CharacterRevealProps {
  character: Character
  onFinalize: () => Promise<void>
  onShowQuestXP?: () => void
}

function CharacterRevealPortrait({ character }: { character: Character }) {
  const uid = useId().replace(/:/g, '')
  const gradId = `reveal-face-${uid}`
  const clipId = `reveal-clip-${uid}`
  const color = CLASS_COLORS[character.class]
  const icon = CLASS_ICONS[character.class]
  const showPhoto = Boolean(character.avatar_url)

  return (
    <svg width="220" height="220" viewBox="0 0 220 220" className="drop-shadow-[0_0_32px_rgba(127,119,221,0.45)]">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0a0a14" stopOpacity="1" />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx="110" cy="110" r="86" />
        </clipPath>
      </defs>
      <circle cx="110" cy="110" r="90" fill={`url(#${gradId})`} stroke={color} strokeWidth="3" opacity={0.95} />
      {showPhoto ? (
        <image
          href={character.avatar_url!}
          x="32"
          y="32"
          width="156"
          height="156"
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <foreignObject x="50" y="50" width="120" height="120" clipPath={`url(#${clipId})`}>
          <div className="flex items-center justify-center w-full h-full select-none" style={{ fontSize: 72, lineHeight: 1 }}>
            {icon}
          </div>
        </foreignObject>
      )}
    </svg>
  )
}

export default function CharacterReveal({ character, onFinalize, onShowQuestXP }: CharacterRevealProps) {
  const navigate = useNavigate()
  const finalized = useRef(false)
  const finalizeRef = useRef(onFinalize)
  const showXpRef = useRef(onShowQuestXP)
  finalizeRef.current = onFinalize
  showXpRef.current = onShowQuestXP

  useEffect(() => {
    const t = window.setTimeout(async () => {
      if (finalized.current) return
      finalized.current = true
      try {
        await finalizeRef.current()
        showXpRef.current?.()
        await new Promise<void>(r => setTimeout(r, 120))
      } catch (e) {
        console.error(e)
      }
      navigate('/dashboard', { replace: true })
    }, NAV_MS)
    return () => window.clearTimeout(t)
  }, [navigate])

  const content = (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: OVERLAY_MS / 1000, ease: 'easeIn' }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center px-6">
        {/* Aura rings — pulse outward, staggered 0.3s */}
        <div className="absolute flex items-center justify-center" style={{ width: 280, height: 280 }}>
          {[0, 1].map(i => (
            <motion.div
              key={i}
              className="absolute rounded-full border-2 border-violet-500/60"
              style={{ width: 120, height: 120, left: '50%', top: '50%', marginLeft: -60, marginTop: -60 }}
              initial={{ scale: 0.4, opacity: 0.75 }}
              animate={{ scale: 2.8, opacity: 0 }}
              transition={{
                duration: 1.35,
                delay: OVERLAY_MS / 1000 + i * 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
        </div>

        <motion.div
          className="relative z-20 flex flex-col items-center"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 16,
            mass: 0.9,
            delay: OVERLAY_MS / 1000,
          }}
        >
          <CharacterRevealPortrait character={character} />
        </motion.div>

        <motion.p
          className="relative z-30 mt-8 text-center text-white font-medium"
          style={{ fontSize: 24 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        >
          Вот ты.
        </motion.p>

        <motion.p
          className="relative z-30 mt-3 text-center text-gray-400 px-4 max-w-sm"
          style={{ fontSize: 15 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 2 }}
        >
          Добро пожаловать в LifeQuest.
        </motion.p>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}
