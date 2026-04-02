import { useState, useEffect } from 'react'
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
  Pencil,
  Trash2,
} from 'lucide-react'
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset'
import { useHabits, useCharacter, useFloatingXP } from '@/hooks/useLifeQuest'
import { isHabitScheduledForDate, localYmd } from '@/lib/date'
import { canUse } from '@/lib/access'
import { SPHERE_COLORS, SPHERE_LABELS, type Sphere } from '@/types'
import type { Character, Habit } from '@/types'
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

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
const WEEKDAY_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

function toggleWeekday(prev: number[], d: number): number[] {
  const next = prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
  return next.sort((a, b) => a - b)
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
  const {
    habits,
    todayLogs,
    weekMarks,
    loading,
    error: habitsLoadError,
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
    completionCounts,
    loadLogsForDate,
    refetch: refetchHabits,
  } = useHabits()
  const todayYmd = localYmd()
  const [viewDate, setViewDate] = useState(() => localYmd())
  const [viewLogs, setViewLogs] = useState<Record<string, boolean>>({})
  const { gainXP } = useCharacter(user.id)
  const { items: xpItems, show: showXP } = useFloatingXP()

  const [showAdd, setShowAdd] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSphere, setNewSphere] = useState<Sphere>('mind')
  const [newWeekdays, setNewWeekdays] = useState<number[]>([...ALL_WEEKDAYS])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (viewDate === todayYmd) {
      setViewLogs(todayLogs)
    }
  }, [viewDate, todayLogs, todayYmd])

  useEffect(() => {
    if (viewDate === todayYmd) return
    let cancelled = false
    const ids = habits.map(h => h.id)
    void loadLogsForDate(viewDate, ids).then(logs => {
      if (!cancelled) setViewLogs(logs)
    })
    return () => {
      cancelled = true
    }
  }, [viewDate, todayYmd, loadLogsForDate, habits])

  const visibleHabits = habits.filter(h => isHabitScheduledForDate(h, viewDate))
  const canToggle = viewDate === todayYmd

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

  function openNewHabitSheet() {
    setEditingHabit(null)
    setNewName('')
    setNewSphere('mind')
    setNewWeekdays([...ALL_WEEKDAYS])
    setShowAdd(true)
  }

  function openEditHabit(habit: Habit) {
    setEditingHabit(habit)
    setNewName(habit.name)
    setNewSphere(habit.sphere as Sphere)
    const w = habit.weekdays
    setNewWeekdays(Array.isArray(w) && w.length > 0 ? [...w] : [...ALL_WEEKDAYS])
    setShowAdd(true)
  }

  async function handleSaveSheet() {
    const trimmed = newName.trim()
    if (!trimmed || saving) return
    if (newWeekdays.length === 0) return

    setSaving(true)
    try {
      if (editingHabit) {
        await updateHabit(editingHabit.id, trimmed, newSphere, newWeekdays)
        closeSheet()
        return
      }
      const allowed = await canUse(user.id, 'habit_add')
      if (!allowed) {
        setShowPaywall(true)
        return
      }
      await addHabit(trimmed, newSphere, newWeekdays)
      closeSheet()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteHabit(deleteTarget.id)
      setDeleteTarget(null)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteBusy(false)
    }
  }

  function closeSheet() {
    setShowAdd(false)
    setEditingHabit(null)
    setNewName('')
    setNewSphere('mind')
    setNewWeekdays([...ALL_WEEKDAYS])
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
          onClick={openNewHabitSheet}
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
            const isToday = mark.date === todayYmd
            const isSelected = mark.date === viewDate
            return (
              <button
                key={mark.date}
                type="button"
                onClick={() => setViewDate(mark.date)}
                className="flex-1 flex flex-col items-center gap-1.5 min-w-0 rounded-lg py-1 -my-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                aria-pressed={isSelected}
                aria-label={`${mark.short}, ${mark.date}`}
              >
                <span
                  className={`text-[10px] uppercase tracking-wide ${isToday ? 'text-violet-300' : 'text-gray-500'}`}
                >
                  {mark.short}
                </span>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    boxShadow: isSelected ? '0 0 0 1px rgba(34,197,94,0.55)' : isToday ? '0 0 0 1px rgba(127,119,221,0.5)' : undefined,
                  }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    initial={false}
                    animate={{
                      width: isSelected || mark.filled ? '100%' : '0%',
                      backgroundColor: isSelected ? '#22c55e' : mark.filled ? '#22c55e' : 'transparent',
                    }}
                    transition={{ duration: 0.35 }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Habits list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-8 space-y-3">
        {habitsLoadError && (
          <div
            className="rounded-xl px-3 py-2 text-sm text-amber-200/95 mb-2"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}
          >
            <p className="mb-2">{habitsLoadError}</p>
            <button
              type="button"
              className="text-violet-300 underline underline-offset-2"
              onClick={() => void refetchHabits()}
            >
              Повторить
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div
              className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : visibleHabits.length === 0 ? (
          <div className="text-center py-16 text-gray-500 px-4">
            <Flame size={40} className="mx-auto mb-3 opacity-25 text-violet-400" />
            <p className="text-base leading-relaxed">
              {habits.length === 0
                ? 'Добавь первый ритуал. Архитектор запомнит.'
                : 'На этот день ничего не запланировано. Поменяй день недели или расписание привычки.'}
            </p>
          </div>
        ) : (
          visibleHabits.map(habit => {
            const done = viewLogs[habit.id] ?? false
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
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-orange-400/95 flex-wrap">
                    <Flame size={14} className="shrink-0" />
                    <span className="tabular-nums font-medium">{habit.streak}</span>
                    <span className="text-gray-600 mx-0.5">·</span>
                    <span className="text-gray-500 tabular-nums">
                      {completionCounts[habit.id] ?? 0} раз
                    </span>
                    <span className="text-gray-600 mx-0.5">·</span>
                    <span className="text-gray-500 truncate">{SPHERE_LABELS[habit.sphere as Sphere]}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditHabit(habit)}
                    className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Изменить привычку"
                  >
                    <Pencil size={18} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(habit)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="Удалить привычку"
                  >
                    <Trash2 size={18} strokeWidth={2} />
                  </button>
                </div>
                <motion.button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-disabled={!canToggle}
                  disabled={!canToggle}
                  onClick={() => canToggle && handleToggle(habit.id)}
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: done ? color : 'rgba(255,255,255,0.06)',
                    borderColor: done ? color : 'rgba(255,255,255,0.12)',
                  }}
                  whileTap={canToggle ? { scale: 0.92 } : undefined}
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

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deleteBusy && setDeleteTarget(null)}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-white">Удалить привычку?</h2>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                «{deleteTarget.name}» и все отметки выполнения будут удалены без восстановления.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl font-medium text-gray-300 bg-white/10"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteBusy}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl font-semibold text-white bg-red-600/90 hover:bg-red-600 disabled:opacity-50"
                  onClick={() => void confirmDelete()}
                  disabled={deleteBusy}
                >
                  {deleteBusy ? '…' : 'Удалить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
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
                  <h3 className="text-lg font-bold text-white">
                    {editingHabit ? 'Редактировать привычку' : 'Новая привычка'}
                  </h3>
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

                <p className="text-xs text-gray-500 mb-2">Дни недели</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setNewWeekdays([...ALL_WEEKDAYS])}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                  >
                    Все дни
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewWeekdays([1, 2, 3, 4, 5])}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                  >
                    Пн–Пт
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewWeekdays([6, 7])}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                  >
                    Выходные
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {ALL_WEEKDAYS.map(d => {
                    const active = newWeekdays.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNewWeekdays(prev => toggleWeekday(prev, d))}
                        className="py-2.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: active ? '#534AB7' : 'rgba(255,255,255,0.06)',
                          color: active ? '#fff' : '#9ca3af',
                        }}
                      >
                        {WEEKDAY_SHORT_RU[d - 1]}
                      </button>
                    )
                  })}
                </div>
                {newWeekdays.length === 0 && (
                  <p className="text-xs text-amber-500/90 mb-2">Выбери хотя бы один день</p>
                )}
              </div>
              <div className="flex-shrink-0 px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                <motion.button
                  type="button"
                  onClick={() => void handleSaveSheet()}
                  disabled={!newName.trim() || saving || newWeekdays.length === 0}
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
