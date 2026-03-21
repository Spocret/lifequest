import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { determineClass } from '@/lib/ai'
import { supabase } from '@/lib/supabase'
import type { Character } from '@/types'
import { SPHERE_COLORS, SPHERE_LABELS, type Sphere } from '@/types'

interface OnboardingProps {
  userId: string
}

const ARCHITECT_MESSAGES = [
  'Ты пришёл. Я знал, что придёшь.',
  'Меня зовут Архитектор. Я наблюдаю за теми, кто выбирает не спать.',
  'Большинство проживают жизнь на автопилоте. Ты — нет.',
  'Один вопрос: что ты хочешь изменить?',
]

const TYPING_MS = 1200
const SCAN_MS = 2000

const SPHERES: Sphere[] = ['mind', 'body', 'spirit', 'resource']

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

function statsForClass(c: Character['class']) {
  const base = { mind: 10, body: 10, spirit: 10, resource: 10 }
  if (c === 'athlete') return { ...base, body: 45, mind: 30 }
  if (c === 'scholar') return { ...base, mind: 45, spirit: 35 }
  if (c === 'entrepreneur') return { ...base, resource: 40, mind: 35 }
  return base
}

function heroName(): string {
  const first = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name?.trim()
  return first && first.length > 0 ? first : 'Путник'
}

type Phase =
  | 'chat'
  | 'choice'
  | 'scanning'
  | 'stats'
  | 'quest'

export default function Onboarding({ userId }: OnboardingProps) {
  const [phase, setPhase] = useState<Phase>('chat')
  const [visibleMessages, setVisibleMessages] = useState<string[]>([])
  const [typing, setTyping] = useState(false)
  const [resolvedClass, setResolvedClass] = useState<Character['class'] | null>(null)
  const [stats, setStats] = useState<{ mind: number; body: number; spirit: number; resource: number } | null>(
    null,
  )
  const [saving, setSaving] = useState(false)
  const cancelled = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [visibleMessages, phase, typing])

  useEffect(() => {
    cancelled.current = false
    let seq = async () => {
      for (let i = 0; i < ARCHITECT_MESSAGES.length; i++) {
        if (cancelled.current) return
        setTyping(true)
        await sleep(TYPING_MS)
        if (cancelled.current) return
        setTyping(false)
        setVisibleMessages(prev => [...prev, ARCHITECT_MESSAGES[i]])
      }
      if (cancelled.current) return
      setPhase('choice')
    }
    seq()
    return () => {
      cancelled.current = true
    }
  }, [])

  const persistCharacter = useCallback(
    async (cls: Character['class'], statBlock: ReturnType<typeof statsForClass>) => {
      const { error } = await supabase
        .from('characters')
        .update({
          name: heroName(),
          class: cls,
          avatar_state: 'silhouette',
          mind: statBlock.mind,
          body: statBlock.body,
          spirit: statBlock.spirit,
          resource: statBlock.resource,
          last_active: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) throw error
    },
    [userId],
  )

  const insertFirstQuest = useCallback(async () => {
    const { error } = await supabase.from('quests').insert({
      user_id: userId,
      title: 'Один честный ответ',
      description: 'Запиши в дневник одну правду о себе, которую обычно не произносишь вслух.',
      sphere: 'spirit',
      difficulty: 'easy',
      xp_reward: 150,
      status: 'active',
      deadline: null,
    })
    if (error) throw error
  }, [userId])

  async function handleAnswer(answer: string) {
    if (phase !== 'choice' || saving) return
    setSaving(true)
    try {
      const cls = await determineClass(answer).catch(() =>
        answer.includes('Себя') ? 'athlete' : 'entrepreneur',
      )
      const statBlock = statsForClass(cls)
      setResolvedClass(cls)
      setStats(statBlock)
      await persistCharacter(cls, statBlock)
      setPhase('scanning')
      await sleep(SCAN_MS)
      setPhase('stats')
      await sleep(2200)
      await insertFirstQuest().catch(e => console.error('Quest insert:', e))
      setPhase('quest')
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function finishToDashboard() {
    window.location.href = '/dashboard'
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#05050c] text-white pt-safe">
      {/* subtle grid + vignette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(rgba(127,119,221,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(127,119,221,0.03) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(83,74,183,0.25),transparent_55%)]" />

      <div className="relative flex-1 flex flex-col min-h-0 px-4 pb-6">
        <header className="shrink-0 pt-2 pb-4 flex items-center gap-2 border-b border-white/5">
          <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-sm font-semibold text-accent">
            А
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Собеседник</p>
            <p className="text-sm font-semibold text-white">Архитектор</p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide py-4 space-y-3 min-h-0">
          {visibleMessages.map((text, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div
                className="max-w-[90%] rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {text}
              </div>
            </motion.div>
          ))}

          <AnimatePresence>
            {typing && phase === 'chat' && (
              <motion.div
                key="typing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-start"
              >
                <div className="rounded-2xl rounded-tl-md px-4 py-3 bg-white/[0.04] border border-white/10 flex gap-1.5 items-center">
                  {[0, 1, 2].map(d => (
                    <motion.span
                      key={d}
                      className="w-2 h-2 rounded-full bg-accent/80"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'choice' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2 pt-2"
            >
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAnswer('Себя целиком')}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                Себя целиком
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAnswer('Свою жизнь')}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white border border-accent/40 bg-accent/15 hover:bg-accent/25 disabled:opacity-50 transition-colors"
              >
                Свою жизнь
              </button>
            </motion.div>
          )}

          {phase === 'quest' && stats && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div
                  className="max-w-[90%] rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  Потенциал есть. Реализация — пока нет.
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl p-4 border border-white/10 mt-2"
                style={{ background: 'rgba(127,119,221,0.08)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc' }}
                      >
                        Ранг F
                      </span>
                      <span className="text-xs text-gray-400">{SPHERE_LABELS.spirit}</span>
                    </div>
                    <h3 className="font-semibold text-white mt-1">Один честный ответ</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Запиши в дневник одну правду о себе, которую обычно не произносишь вслух.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-accent text-sm font-medium pt-3 mt-3 border-t border-white/10">
                  <span>+150 XP</span>
                </div>
              </motion.div>

              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                onClick={finishToDashboard}
                className="w-full mt-4 py-4 rounded-2xl font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
              >
                Начать путь
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Full-screen overlays */}
      <AnimatePresence>
        {phase === 'scanning' && (
          <motion.div
            key="scan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020208]"
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(127,119,221,0.45) 0%, transparent 55%)',
              }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.85, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="w-40 h-40 rounded-full border-2 border-accent/30"
              animate={{ scale: [1, 1.08, 1], rotate: [0, 180, 360] }}
              transition={{ duration: 2, ease: 'linear' }}
            />
            <p className="relative z-10 mt-8 text-sm text-gray-400 tracking-wide">Сканирование профиля…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'stats' && stats && (
          <motion.div
            key="stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6 bg-[#05050c]/95 backdrop-blur-sm"
          >
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Профиль</p>
            <p className="text-lg font-semibold text-white mb-6">
              {resolvedClass
                ? {
                    athlete: 'Атлет',
                    scholar: 'Учёный',
                    entrepreneur: 'Предприниматель',
                    warrior: 'Воин',
                    mage: 'Маг',
                    rogue: 'Плут',
                    healer: 'Целитель',
                  }[resolvedClass]
                : ''}
            </p>
            <div className="w-full max-w-sm space-y-4">
              {SPHERES.map(s => {
                const v = stats[s]
                const color = SPHERE_COLORS[s]
                return (
                  <div key={s}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{SPHERE_LABELS[s]}</span>
                      <span className="text-white font-medium">{v}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, v)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
