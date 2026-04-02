import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Flame, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { levelRankName } from '@/lib/levelRanks'
import CharacterAvatar from '@/components/CharacterAvatar'
import TrialBadge from '@/components/TrialBadge'
import QuestCard from '@/components/QuestCard'
import {
  useCharacter,
  usePlan,
  useQuests,
  useHabits,
  useDegradationWarning,
  useXPProgress,
} from '@/hooks/useLifeQuest'
import { isHabitScheduledForDate, localYmd } from '@/lib/date'
import type { User } from '@/types'
import { SPHERE_COLORS, SPHERE_LABELS, type Sphere } from '@/types'

interface DashboardProps {
  user: User
}

const SPHERES: Sphere[] = ['mind', 'body', 'spirit', 'resource']

function RitualModal({
  open,
  step,
  onStep,
  onClose,
  onComplete,
}: {
  open: boolean
  step: number
  onStep: (n: number) => void
  onClose: () => void
  onComplete: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="w-full max-w-md rounded-3xl p-6"
            style={{ background: '#12121f', border: '1px solid rgba(127, 119, 221, 0.3)' }}
          >
            <p className="text-xs uppercase tracking-widest text-violet-400 mb-3">Ритуал воскрешения</p>
            {step === 1 ? (
              <>
                <p className="text-white text-sm mb-6 leading-relaxed">
                  Что для тебя важнее всего вернуть в движение прямо сейчас?
                </p>
                <button
                  type="button"
                  className="w-full py-3 rounded-2xl font-semibold text-white mb-2"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  onClick={() => onStep(2)}
                >
                  Далее
                </button>
              </>
            ) : (
              <>
                <p className="text-white text-sm mb-6 leading-relaxed">
                  Назови одно маленькое действие, которое сделаешь сегодня.
                </p>
                <button
                  type="button"
                  className="w-full py-3 rounded-2xl font-semibold text-white mb-2"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  onClick={() => void onComplete()}
                >
                  Завершить ритуал
                </button>
              </>
            )}
            <button type="button" className="w-full py-2 text-sm text-gray-500" onClick={onClose}>
              Закрыть
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Pre-reveal hero placeholder: flat SVG only (no overflow-hidden / CSS blur) so nothing clips. */
function MysterySilhouette() {
  return (
    <div className="relative flex justify-center w-full max-w-[260px] mx-auto px-2">
      <svg
        viewBox="0 0 280 288"
        className="w-full h-auto max-h-[min(52vh,300px)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <radialGradient id="ms-ambient" cx="50%" cy="36%" r="70%">
            <stop offset="0%" stopColor="rgba(127, 119, 221, 0.26)" />
            <stop offset="55%" stopColor="rgba(83, 74, 183, 0.07)" />
            <stop offset="100%" stopColor="rgba(12, 12, 22, 0)" />
          </radialGradient>
          <linearGradient id="ms-fill" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#423368" />
            <stop offset="100%" stopColor="#120c18" />
          </linearGradient>
          <linearGradient id="ms-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ddd6fe" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect width="280" height="288" fill="url(#ms-ambient)" />
        <circle
          cx="140"
          cy="138"
          r="108"
          stroke="rgba(127, 119, 221, 0.2)"
          strokeWidth="1"
          strokeDasharray="6 12"
        />
        {/* Сначала корпус, затем голова поверх — ровный стык без «зазора» */}
        <path
          d="M 78 266
            L 78 178
            C 78 152 104 142 132 144
            C 136 143 140 142 140 142
            C 140 142 144 143 148 144
            C 176 142 202 152 202 178
            L 202 266
            Z"
          fill="url(#ms-fill)"
          stroke="url(#ms-stroke)"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <ellipse
          cx="140"
          cy="105"
          rx="36"
          ry="39"
          fill="url(#ms-fill)"
          stroke="url(#ms-stroke)"
          strokeWidth="1.35"
        />
        {/* Замок вместо «?» — тот же stroke, композиция как в app lock / hidden identity */}
        <g transform="translate(140 196)">
          <path
            d="M-11-14v-6a11 11 0 0 1 22 0v6"
            stroke="url(#ms-stroke)"
            strokeWidth="1.65"
            strokeLinecap="round"
            opacity={0.9}
          />
          <rect
            x="-14"
            y="-14"
            width="28"
            height="20"
            rx="3.5"
            stroke="url(#ms-stroke)"
            strokeWidth="1.65"
            fill="rgba(127, 119, 221, 0.07)"
          />
          <circle r="2" fill="#c4b5fd" opacity={0.7} />
        </g>
      </svg>
    </div>
  )
}

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate()
  const { character, loading: charLoading, refetch: refetchCharacter } = useCharacter(user.id)
  const { isTrialActive, daysLeft, isPro } = usePlan(user.id)
  const { quests, loading: questsLoading } = useQuests(user.id)
  const {
    habits,
    todayLogs,
    toggleHabit,
    loading: habitsLoading,
    error: habitsError,
    refetch: refetchHabits,
  } = useHabits()
  const todayYmd = localYmd()
  const habitsToday = habits.filter(h => isHabitScheduledForDate(h, todayYmd))
  const { warning, isDegrading, stage } = useDegradationWarning(character?.last_active, isPro)

  const [showDay5Bar, setShowDay5Bar] = useState(false)
  const [ritualOpen, setRitualOpen] = useState(false)
  const [ritualStep, setRitualStep] = useState(1)

  useEffect(() => {
    if (user.plan !== 'trial' || !isTrialActive || daysLeft !== 1) {
      setShowDay5Bar(false)
      return
    }
    if (sessionStorage.getItem('lq_day5_offer_seen') === '1') return
    setShowDay5Bar(true)
  }, [user.plan, isTrialActive, daysLeft])

  const dismissDay5Bar = useCallback(() => {
    sessionStorage.setItem('lq_day5_offer_seen', '1')
    setShowDay5Bar(false)
  }, [])

  const imbalanceGap = useMemo(() => {
    if (!character) return null
    const vals = [character.mind, character.body, character.spirit, character.resource]
    const gap = Math.max(...vals) - Math.min(...vals)
    return gap >= 20 ? gap : null
  }, [character])

  const completeRitual = useCallback(async () => {
    if (!character) return
    await supabase
      .from('characters')
      .update({
        degradation_stage: 0,
        last_active: new Date().toISOString(),
      })
      .eq('id', character.id)
    await refetchCharacter?.()
    setRitualOpen(false)
    setRitualStep(1)
  }, [character, refetchCharacter])

  const showTrialBadge = user.plan === 'trial' && isTrialActive && daysLeft > 0

  const { progress, xpToNext, nextThreshold } = useXPProgress(
    character?.xp ?? 0,
    character?.level ?? 1,
  )

  if (charLoading || !character) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  const isRevealed = character.avatar_state === 'revealed'

  if (!isRevealed) {
    const primaryQuest = quests[0]
    return (
      <div className="min-h-dvh bg-background flex flex-col relative">
        {showDay5Bar && (
          <div className="px-4 pt-safe pb-2 z-20">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 flex flex-col gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(83,74,183,0.35), rgba(12,12,22,0.95))',
                border: '1px solid rgba(127, 119, 221, 0.45)',
              }}
            >
              <div className="flex items-start gap-2">
                <Sparkles className="text-accent shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-gray-100 leading-snug">
                  Пятый день испытания. Завтра часть пути станет недоступна — реши сейчас.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  onClick={() => navigate('/upgrade?fromTrial=1')}
                >
                  Продолжить путь
                </button>
                <button type="button" className="text-xs text-gray-500 px-2" onClick={dismissDay5Bar}>
                  Позже
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {showTrialBadge && (
          <div className="absolute top-0 right-4 z-10 pt-safe pr-0 flex justify-end">
            <TrialBadge
              daysLeft={daysLeft}
              onClick={() => navigate(daysLeft === 1 ? '/upgrade?fromTrial=1' : '/referral')}
            />
          </div>
        )}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-24 px-4 pt-safe flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center min-h-[42vh] pt-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45 }}
            >
              <MysterySilhouette />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl px-5 py-4 mb-5 text-center"
            style={{ background: 'rgba(12, 12, 22, 0.95)', border: '1px solid rgba(127, 119, 221, 0.2)' }}
          >
            <p className="text-sm sm:text-base text-gray-200 italic leading-relaxed">
              Выполни первый квест — узнаешь кто ты.
            </p>
          </motion.div>

          {isDegrading && (
            <motion.div
              className="rounded-2xl p-4 mb-4 border border-violet-900/50 bg-gradient-to-b from-black/80 to-violet-950/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-[10px] uppercase tracking-widest text-violet-400/90 mb-2">Тень</p>
              <p className="text-gray-200 text-sm flex items-start gap-2">
                <Flame size={16} className="text-violet-400 shrink-0 mt-0.5" />
                {warning}
              </p>
              {stage === 4 && (
                <button
                  type="button"
                  className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-white border border-violet-500/40"
                  style={{ background: 'rgba(83, 74, 183, 0.25)' }}
                  onClick={() => setRitualOpen(true)}
                >
                  Ритуал воскрешения
                </button>
              )}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl overflow-hidden mb-4"
            style={{
              background: 'linear-gradient(145deg, rgba(83,74,183,0.18), rgba(18,18,31,0.95))',
              border: '1px solid rgba(127, 119, 221, 0.25)',
            }}
          >
            {questsLoading ? (
              <div className="p-6 text-center text-gray-500 text-sm">Загрузка квеста…</div>
            ) : primaryQuest ? (
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Твой квест</p>
                <h3 className="font-semibold text-white text-lg mb-1">{primaryQuest.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-3">{primaryQuest.description}</p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <span className="text-accent text-sm font-medium">+{primaryQuest.xp_reward} XP</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-400 text-sm mb-4">Квест скоро появится.</p>
              </div>
            )}
            <motion.button
              type="button"
              onClick={() => navigate('/journal/new')}
              className="w-full flex items-center justify-center gap-2 py-4 font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
              whileTap={{ scale: 0.98 }}
            >
              Открыть дневник
              <ChevronRight size={20} />
            </motion.button>
          </motion.div>
        </div>
        <RitualModal
          open={ritualOpen}
          step={ritualStep}
          onStep={setRitualStep}
          onClose={() => {
            setRitualOpen(false)
            setRitualStep(1)
          }}
          onComplete={completeRitual}
        />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {showDay5Bar && (
        <div className="px-4 pt-safe pb-2 shrink-0 z-20">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(83,74,183,0.35), rgba(12,12,22,0.95))',
              border: '1px solid rgba(127, 119, 221, 0.45)',
            }}
          >
            <div className="flex items-start gap-2">
              <Sparkles className="text-accent shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-gray-100 leading-snug">
                Пятый день испытания. Завтра часть пути станет недоступна — реши сейчас.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                onClick={() => navigate('/upgrade?fromTrial=1')}
              >
                Продолжить путь
              </button>
              <button type="button" className="text-xs text-gray-500 px-2" onClick={dismissDay5Bar}>
                Позже
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-24 px-4 pt-safe">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #534AB7, #7F77DD)',
                  boxShadow: '0 0 20px rgba(127, 119, 221, 0.25)',
                }}
              >
                {levelRankName(character.level)} · ур. {character.level}
              </span>
              <span className="text-xs text-gray-500">
                {character.name || user.tg_username || 'Герой'}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Опыт</span>
                <span>
                  {xpToNext} XP до след. уровня
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #534AB7, #7F77DD)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>{character.xp} XP</span>
                <span>{nextThreshold} XP</span>
              </div>
            </div>
          </div>
          {showTrialBadge && (
            <TrialBadge
              daysLeft={daysLeft}
              onClick={() => navigate(daysLeft === 1 ? '/upgrade?fromTrial=1' : '/referral')}
            />
          )}
        </div>

        <motion.div
          className="flex justify-center mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CharacterAvatar character={character} size="lg" auraPulse />
        </motion.div>

        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Характеристики</h2>
          <div className="space-y-3">
            {SPHERES.map(s => {
              const v = character[s]
              const color = SPHERE_COLORS[s]
              const label = SPHERE_LABELS[s]
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-semibold">{v}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, v)}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {imbalanceGap !== null && (
          <motion.div
            className="rounded-2xl p-4 mb-5 border border-amber-500/25 bg-amber-500/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-[10px] uppercase tracking-widest text-amber-400/90 mb-1">Дисбаланс</p>
            <p className="text-sm text-amber-100/90">
              Одна сфера сильно отстаёт (разрыв {imbalanceGap}+). Архитектор будет класть акцент на слабое звено.
            </p>
          </motion.div>
        )}

        {isDegrading && (
          <motion.div
            className="rounded-2xl p-4 mb-5 border border-violet-900/50 bg-gradient-to-b from-black/80 to-violet-950/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-[10px] uppercase tracking-widest text-violet-400/90 mb-2">Тень</p>
            <p className="text-gray-200 text-sm flex items-start gap-2">
              <Flame size={16} className="text-violet-400 shrink-0 mt-0.5" />
              {warning}
            </p>
            {stage === 4 && (
              <button
                type="button"
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-white border border-violet-500/40"
                style={{ background: 'rgba(83, 74, 183, 0.25)' }}
                onClick={() => setRitualOpen(true)}
              >
                Ритуал воскрешения
              </button>
            )}
          </motion.div>
        )}

        <section className="mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Сегодня</h2>

          <div className="mb-5">
            <p className="text-sm text-gray-400 mb-2">Активные квесты</p>
            {questsLoading ? (
              <p className="text-gray-600 text-sm">Загрузка…</p>
            ) : quests.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/quests')}
                className="text-sm text-accent underline-offset-2 hover:underline"
              >
                Добавить квест
              </button>
            ) : (
              <div className="space-y-3">
                {quests.slice(0, 5).map(q => (
                  <QuestCard key={q.id} quest={q} variant="preview" />
                ))}
                {quests.length > 5 && (
                  <button
                    type="button"
                    onClick={() => navigate('/quests')}
                    className="text-xs text-accent w-full text-center py-2"
                  >
                    Все квесты ({quests.length})
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-400 mb-2">Привычки</p>
            {habitsError && (
              <div className="text-sm text-amber-200/90 mb-2 space-y-1">
                <p>Не удалось загрузить. {habitsError}</p>
                <button
                  type="button"
                  className="text-accent underline-offset-2 hover:underline"
                  onClick={() => void refetchHabits()}
                >
                  Обновить
                </button>
              </div>
            )}
            {habitsLoading ? (
              <p className="text-gray-600 text-sm">Загрузка…</p>
            ) : habitsError ? null : habitsToday.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/habits')}
                className="text-sm text-accent underline-offset-2 hover:underline"
              >
                Создать привычку
              </button>
            ) : (
              <div className="space-y-2">
                {habitsToday.map(habit => {
                  const done = todayLogs[habit.id] ?? false
                  const color = SPHERE_COLORS[habit.sphere as Sphere] ?? '#7F77DD'
                  return (
                    <motion.button
                      key={habit.id}
                      type="button"
                      onClick={() => toggleHabit(habit.id)}
                      className="w-full flex items-center gap-3 rounded-xl p-3 text-left"
                      style={{
                        background: done ? `${color}14` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${done ? color + '44' : 'rgba(255,255,255,0.08)'}`,
                      }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <span
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border-2"
                        style={{
                          borderColor: done ? color : 'rgba(255,255,255,0.2)',
                          background: done ? color : 'transparent',
                        }}
                      >
                        {done && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-white text-xs font-bold">
                            ✓
                          </motion.span>
                        )}
                      </span>
                      <span className={`text-sm flex-1 ${done ? 'text-gray-200 line-through decoration-white/30' : 'text-white'}`}>
                        {habit.name}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <RitualModal
        open={ritualOpen}
        step={ritualStep}
        onStep={setRitualStep}
        onClose={() => {
          setRitualOpen(false)
          setRitualStep(1)
        }}
        onComplete={completeRitual}
      />
    </div>
  )
}
