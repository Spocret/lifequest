import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  Flame,
  Check,
  X,
  Brain,
  Activity,
  Sparkles,
  Gem,
} from 'lucide-react'
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset'
import { useHabits, useCharacter, useFloatingXP } from '@/hooks/useLifeQuest'
import { canUse } from '@/lib/access'
import { SPHERE_COLORS, SPHERE_LABELS, type Sphere } from '@/types'
import type { Character } from '@/types'
import type { User } from '@/types'

interface HabitsProps {
  user: User
}

const SPHERES: Sphere[] = ['mind', 'body', 'spirit', 'resource']

const SPHERE_ICON: Record<Sphere, typeof Brain> = {
  mind: Brain,
  body: Activity,
  spirit: Sparkles,
  resource: Gem,
}

const SPHERE_STAT: Record<Sphere, keyof Pick<Character, 'mind' | 'body' | 'spirit' | 'resource'>> = {
  mind: 'mind',
  body: 'body',
  spirit: 'spirit',
  resource: 'resource',
}

function LockIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  )
}

export default function Habits({ user }: HabitsProps) {
  const navigate = useNavigate()
  const { bottomInset, height: vvHeight } = useVisualViewportInset()
  const { habits, todayLogs, weekMarks, loading, toggleHabit, addHabit } = useHabits()
  const { gainXP } = useCharacter(user.id)
  const { items: xpItems, show: showXP } = useFloatingXP()

  const [showAdd, setShowAdd] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSphere, setNewSphere] = useState<Sphere>('mind')
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  async function handleToggle(id: string) {
    const result = await toggleHabit(id)
    if (!result.completed || !result.habit) return

    const sphere = result.habit.sphere as Sphere
    const stat = SPHERE_STAT[sphere]

    await gainXP?.(30, stat, 2)
    showXP(30, '+30 XP', 50)

    if (result.streakBonus) {
      await gainXP?.(50, stat, 1)
      window.setTimeout(() => showXP(50, '7 дней', 50), 180)
    }
  }

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed || saving) return

    setSaving(true)
    try {
      const allowed = await canUse(user.id, 'habit_add')
      if (!allowed) {
        setShowPaywall(true)
        return
      }
      await addHabit(trimmed, newSphere, frequency)
      setNewName('')
      setNewSphere('mind')
      setFrequency('daily')
      setShowAdd(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function closeSheet() {
    setShowAdd(false)
    setNewName('')
    setNewSphere('mind')
    setFrequency('daily')
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-24">
      <div className="flex items-center gap-3 px-4 pt-safe pb-4">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white flex-1">Привычки</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="p-2 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
          aria-label="Добавить привычку"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Week Mon–Sun */}
      <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs text-gray-500 mb-3">Неделя</p>
        <div className="flex gap-1.5">
          {weekMarks.map(mark => {
            const isToday = mark.date === today
            return (
              <div key={mark.date} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span
                  className={`text-[10px] uppercase tracking-wide ${isToday ? 'text-violet-300' : 'text-gray-500'}`}
                >
                  {mark.short}
                </span>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    boxShadow: isToday ? '0 0 0 1px rgba(127,119,221,0.5)' : undefined,
                  }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    initial={false}
                    animate={{
                      width: mark.filled ? '100%' : '0%',
                      backgroundColor: mark.filled ? '#22c55e' : 'transparent',
                    }}
                    transition={{ duration: 0.35 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Habits list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-8 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div
              className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : habits.length === 0 ? (
          <div className="text-center py-16 text-gray-500 px-4">
            <Flame size={40} className="mx-auto mb-3 opacity-25 text-violet-400" />
            <p className="text-base leading-relaxed">Добавь первый ритуал. Архитектор запомнит.</p>
          </div>
        ) : (
          habits.map(habit => {
            const done = todayLogs[habit.id] ?? false
            const color = SPHERE_COLORS[habit.sphere as Sphere] ?? '#7F77DD'
            const SphereIc = SPHERE_ICON[habit.sphere as Sphere] ?? Brain
            return (
              <motion.div
                key={habit.id}
                className="flex items-center gap-3 rounded-2xl pl-3 pr-2 py-3 min-h-[56px]"
                style={{
                  background: done ? `${color}12` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${done ? color + '33' : 'rgba(255,255,255,0.08)'}`,
                }}
                layout
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}22`, color }}
                >
                  <SphereIc size={20} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${done ? 'line-through text-gray-500' : 'text-white'}`}>
                    {habit.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-orange-400/95">
                    <Flame size={14} className="shrink-0" />
                    <span className="tabular-nums font-medium">{habit.streak}</span>
                    <span className="text-gray-600 mx-0.5">·</span>
                    <span className="text-gray-500 truncate">{SPHERE_LABELS[habit.sphere as Sphere]}</span>
                  </div>
                </div>
                <motion.button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  onClick={() => handleToggle(habit.id)}
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border"
                  style={{
                    background: done ? color : 'rgba(255,255,255,0.06)',
                    borderColor: done ? color : 'rgba(255,255,255,0.12)',
                  }}
                  whileTap={{ scale: 0.92 }}
                >
                  {done && <Check size={22} className="text-white" strokeWidth={2.5} />}
                </motion.button>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Floating XP */}
      <AnimatePresence>
        {xpItems.map(item => (
          <motion.div
            key={item.id}
            className="fixed text-accent font-bold text-lg pointer-events-none z-[90]"
            style={{ left: `${item.x}%`, bottom: '40%' }}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -60 }}
            transition={{ duration: 1.2 }}
          >
            +{item.amount} {item.label}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Paywall modal */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPaywall(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl p-6 text-center"
              style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <LockIcon />
              <h2 className="text-lg font-semibold text-white mt-3">Новые привычки</h2>
              <p className="text-sm text-gray-400 italic max-w-xs mx-auto leading-relaxed mt-2">
                Эта часть пути открыта тем кто продолжает
              </p>
              <Link
                to="/upgrade"
                className="mt-5 block w-full py-3.5 rounded-2xl font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                onClick={() => setShowPaywall(false)}
              >
                ✦ Открыть Pro 490 ₽/мес
              </Link>
              <button
                type="button"
                className="mt-3 text-sm text-gray-500"
                onClick={() => setShowPaywall(false)}
              >
                Закрыть
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add habit bottom sheet */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-[60]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
            />
            <motion.div
              className="fixed left-0 right-0 z-[70] rounded-t-3xl flex flex-col min-h-0"
              style={{
                bottom: bottomInset,
                maxHeight: Math.max(0, vvHeight - 8),
                background: '#12121f',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="overflow-y-auto flex-1 min-h-0 px-6 pt-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-white">Новая привычка</h3>
                  <button type="button" onClick={closeSheet} className="p-2 rounded-full bg-white/10">
                    <X size={16} />
                  </button>
                </div>
                <label className="block text-xs text-gray-500 mb-1.5">Название</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Как назовём ритуал?"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 mb-5"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />

                <p className="text-xs text-gray-500 mb-2">Сфера</p>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {SPHERES.map(s => {
                    const active = newSphere === s
                    const col = SPHERE_COLORS[s]
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewSphere(s)}
                        className="py-3 px-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                        style={{
                          background: active ? col + '28' : 'rgba(255,255,255,0.05)',
                          border: `2px solid ${active ? col : 'transparent'}`,
                          color: active ? col : '#9ca3af',
                          boxShadow: active ? `0 0 20px ${col}22` : undefined,
                        }}
                      >
                        {SPHERE_LABELS[s]}
                      </button>
                    )
                  })}
                </div>

                <p className="text-xs text-gray-500 mb-2">Частота</p>
                <div className="flex rounded-xl p-1 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <button
                    type="button"
                    onClick={() => setFrequency('daily')}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: frequency === 'daily' ? '#534AB7' : 'transparent',
                      color: frequency === 'daily' ? '#fff' : '#9ca3af',
                    }}
                  >
                    Каждый день
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('weekly')}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: frequency === 'weekly' ? '#534AB7' : 'transparent',
                      color: frequency === 'weekly' ? '#fff' : '#9ca3af',
                    }}
                  >
                    Раз в неделю
                  </button>
                </div>
              </div>
              <div className="flex-shrink-0 px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                <motion.button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newName.trim() || saving}
                  className="w-full py-4 rounded-2xl font-semibold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
