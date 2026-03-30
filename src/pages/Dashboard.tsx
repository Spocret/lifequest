import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Flame } from 'lucide-react'
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
import type { User } from '@/types'
import { SPHERE_COLORS, SPHERE_LABELS, type Sphere } from '@/types'

interface DashboardProps {
  user: User
}

const SPHERES: Sphere[] = ['mind', 'body', 'spirit', 'resource']

function MysterySilhouette() {
  return (
    <div className="relative flex flex-col items-center justify-center w-48 h-56 mx-auto">
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ filter: 'blur(10px)' }}
      >
        <svg
          viewBox="0 0 200 240"
          className="w-44 h-52 opacity-90"
          aria-hidden
        >
          <defs>
            <linearGradient id="sil-hid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e1035" />
              <stop offset="50%" stopColor="#2d1b4e" />
              <stop offset="100%" stopColor="#0f0a18" />
            </linearGradient>
          </defs>
          <ellipse cx="100" cy="52" rx="38" ry="44" fill="url(#sil-hid)" />
          <path
            d="M 100 98 C 52 98 28 128 22 168 L 18 232 L 182 232 L 178 168 C 172 128 148 98 100 98 Z"
            fill="url(#sil-hid)"
          />
        </svg>
      </div>
      <div
        className="relative flex items-center justify-center w-44 h-52 rounded-3xl overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 50% 35%, rgba(127,119,221,0.35), transparent 62%)',
        }}
      >
        <svg viewBox="0 0 200 240" className="w-40 h-48 opacity-[0.85]" aria-hidden>
          <defs>
            <linearGradient id="sil-fg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4c1d95" />
              <stop offset="100%" stopColor="#1a0d2e" />
            </linearGradient>
          </defs>
          <ellipse cx="100" cy="52" rx="36" ry="42" fill="url(#sil-fg)" />
          <path
            d="M 100 96 C 54 96 32 124 28 162 L 24 228 L 176 228 L 172 162 C 168 124 146 96 100 96 Z"
            fill="url(#sil-fg)"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[5.5rem] font-serif font-light leading-none select-none pointer-events-none"
          style={{
            color: '#a78bfa',
            textShadow: '0 0 40px rgba(127, 119, 221, 0.65)',
            paddingBottom: '0.15em',
          }}
        >
          ?
        </span>
      </div>
    </div>
  )
}

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate()
  const { character, loading: charLoading } = useCharacter(user.id)
  const { isTrialActive, daysLeft } = usePlan(user.id)
  const { quests, loading: questsLoading } = useQuests(user.id)
  const { habits, todayLogs, toggleHabit, loading: habitsLoading } = useHabits(user.id)
  const { warning, isDegrading } = useDegradationWarning(character?.last_active)

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
        {showTrialBadge && (
          <div className="absolute top-0 right-4 z-10 pt-safe pr-0 flex justify-end">
            <TrialBadge daysLeft={daysLeft} onClick={() => navigate('/referral')} />
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
              className="rounded-2xl p-4 mb-4 border border-red-500/30 bg-red-500/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-red-400 text-sm flex items-center gap-2">
                <Flame size={16} />
                {warning}
              </p>
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
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
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
                Ур. {character.level}
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
            <TrialBadge daysLeft={daysLeft} onClick={() => navigate('/referral')} />
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

        {isDegrading && (
          <motion.div
            className="rounded-2xl p-4 mb-5 border border-red-500/30 bg-red-500/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-red-400 text-sm flex items-center gap-2">
              <Flame size={16} />
              {warning}
            </p>
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
            {habitsLoading ? (
              <p className="text-gray-600 text-sm">Загрузка…</p>
            ) : habits.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/habits')}
                className="text-sm text-accent underline-offset-2 hover:underline"
              >
                Создать привычку
              </button>
            ) : (
              <div className="space-y-2">
                {habits.map(habit => {
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
    </div>
  )
}
