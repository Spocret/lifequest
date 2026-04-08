import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { isHabitScheduledForDate, isoWeekdayFromYmd, localYmd } from '@/lib/date'
import { canUse } from '@/lib/access'
import PaywallModal from '@/components/PaywallModal'
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

function ymdMinusDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function ymdFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function isoWeekdayFromDate(d: Date): number {
  const wd = d.getDay()
  return wd === 0 ? 7 : wd
}

function monthStartEnd(ymd: string): { start: string; end: string } {
  const d = ymdToDate(ymd)
  const startDt = new Date(d.getFullYear(), d.getMonth(), 1)
  const endDt = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: ymdFromDate(startDt), end: ymdFromDate(endDt) }
}

function monthLabelRu(ymd: string): string {
  const d = ymdToDate(ymd)
  return d.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
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
    bulkUpdateHabits,
    bulkDeleteHabits,
    deleteHabit,
    completionCounts,
    loadLogsForDate,
    fetchRangeMarks,
    refetch: refetchHabits,
    showArchived,
    setShowArchived,
    habitRetroDays,
    updateHabitRetroDays,
  } = useHabits()
  const todayYmd = localYmd()
  const earliestToggleYmd = ymdMinusDays(todayYmd, habitRetroDays)
  const [viewDate, setViewDate] = useState(() => localYmd())
  const [topMode, setTopMode] = useState<'week' | 'month'>('week')
  const [monthCursor, setMonthCursor] = useState(() => localYmd())
  const [monthMarks, setMonthMarks] = useState<Record<string, { done: number; total: number }>>({})
  const [insights, setInsights] = useState<{
    stabilityPct: number
    totalPlanned: number
    totalDone: number
    overloadWeekday: number | null
    weakWeekday: number | null
  }>({ stabilityPct: 0, totalPlanned: 0, totalDone: 0, overloadWeekday: null, weakWeekday: null })
  const [viewLogs, setViewLogs] = useState<Record<string, boolean>>({})
  const { gainXP } = useCharacter(user.id)
  const { items: xpItems, show: showXP } = useFloatingXP()

  const [showAdd, setShowAdd] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [showBulkSchedule, setShowBulkSchedule] = useState(false)
  const [showBulkSphere, setShowBulkSphere] = useState(false)
  const [showRetroSettings, setShowRetroSettings] = useState(false)
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([...ALL_WEEKDAYS])
  const [bulkSphere, setBulkSphere] = useState<Sphere>('mind')
  const [newName, setNewName] = useState('')
  const [newSphere, setNewSphere] = useState<Sphere>('mind')
  const [newWeekdays, setNewWeekdays] = useState<number[]>([...ALL_WEEKDAYS])
  const [saving, setSaving] = useState(false)
  const [quickAddBusy, setQuickAddBusy] = useState(false)

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

  useEffect(() => {
    if (topMode !== 'month') return
    let cancelled = false
    const { start, end } = monthStartEnd(monthCursor)
    void fetchRangeMarks(habits, start, end).then(rows => {
      if (cancelled) return
      const next: Record<string, { done: number; total: number }> = {}
      rows.forEach(r => { next[r.date] = { done: r.done, total: r.total } })
      setMonthMarks(next)
    })
    return () => { cancelled = true }
  }, [topMode, monthCursor, habits, fetchRangeMarks])

  useEffect(() => {
    let cancelled = false
    const end = todayYmd
    const start = ymdMinusDays(todayYmd, 27)
    void fetchRangeMarks(habits, start, end).then(rows => {
      if (cancelled) return
      let totalPlanned = 0
      let totalDone = 0
      const byWd = new Map<number, { planned: number; done: number }>()
      rows.forEach(r => {
        totalPlanned += r.total
        totalDone += r.done
        const wd = isoWeekdayFromYmd(r.date)
        const cur = byWd.get(wd) ?? { planned: 0, done: 0 }
        cur.planned += r.total
        cur.done += r.done
        byWd.set(wd, cur)
      })
      const stabilityPct = totalPlanned === 0 ? 0 : Math.round((totalDone / totalPlanned) * 100)

      let overloadWeekday: number | null = null
      let maxPlanned = -1
      let weakWeekday: number | null = null
      let minRatio = Infinity

      for (const [wd, v] of byWd.entries()) {
        if (v.planned > maxPlanned) {
          maxPlanned = v.planned
          overloadWeekday = wd
        }
        if (v.planned > 0) {
          const ratio = v.done / v.planned
          if (ratio < minRatio) {
            minRatio = ratio
            weakWeekday = wd
          }
        }
      }

      setInsights({ stabilityPct, totalPlanned, totalDone, overloadWeekday, weakWeekday })
    })
    return () => { cancelled = true }
  }, [habits, fetchRangeMarks, todayYmd])

  const visibleHabits = habits.filter(h => isHabitScheduledForDate(h, viewDate))
  const canToggle = viewDate >= earliestToggleYmd && viewDate <= todayYmd

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function quickAdd(name: string, sphere: Sphere, weekdays: number[]) {
    if (quickAddBusy) return
    setQuickAddBusy(true)
    try {
      const allowed = await canUse(user.id, 'habit_add')
      if (!allowed) {
        setShowPaywall(true)
        return
      }
      await addHabit(name, sphere, weekdays)
    } catch (e) {
      console.error(e)
    } finally {
      setQuickAddBusy(false)
    }
  }

  async function handleToggle(id: string) {
    const result = await toggleHabit(id, viewDate)
    if (!result.habit) return

    if (viewDate !== todayYmd) {
      setViewLogs(prev => ({ ...prev, [id]: result.completed }))
    }

    if (!result.completed) return
    if (!result.xpAwarded) return

    const sphere = result.habit.sphere as Sphere
    const stat = SPHERE_STAT[sphere]

    await gainXP?.(result.xpAwarded, stat, 2)
    showXP(result.xpAwarded, `+${result.xpAwarded} XP`, 50)

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

  async function runBulkUpdate(patch: Parameters<typeof bulkUpdateHabits>[1]) {
    if (bulkBusy) return
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      await bulkUpdateHabits(ids, patch)
      exitSelectMode()
    } catch (e) {
      console.error(e)
    } finally {
      setBulkBusy(false)
    }
  }

  async function runBulkDelete() {
    if (bulkBusy) return
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const ok = window.confirm(`Удалить выбранные привычки (${ids.length}) и все их отметки?`)
    if (!ok) return
    setBulkBusy(true)
    try {
      await bulkDeleteHabits(ids)
      exitSelectMode()
    } catch (e) {
      console.error(e)
    } finally {
      setBulkBusy(false)
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
        <h1 className="text-xl font-bold text-white flex-1">
          {selectMode ? `Выбрано: ${selectedIds.size}` : 'Привычки'}
        </h1>
        {!selectMode && (
          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-gray-200"
            aria-pressed={showArchived}
            title={showArchived ? 'Скрыть архив' : 'Показать архив'}
          >
            {showArchived ? 'Архив: ON' : 'Архив'}
          </button>
        )}
        {!selectMode && (
          <button
            type="button"
            onClick={() => setShowRetroSettings(true)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-gray-200"
            aria-label="Настроить окно ретро"
            title="Окно ретро-отметок"
          >
            Ретро: {habitRetroDays}д
          </button>
        )}
        <button
          type="button"
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-gray-200"
          aria-pressed={selectMode}
        >
          {selectMode ? 'Готово' : 'Выбрать'}
        </button>
        <button
          type="button"
          onClick={openNewHabitSheet}
          className="p-2 rounded-xl disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
          aria-label="Добавить привычку"
          disabled={selectMode}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Week Mon–Sun */}
      <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">{topMode === 'week' ? 'Неделя' : monthLabelRu(monthCursor)}</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={`text-xs px-3 py-1.5 rounded-lg ${topMode === 'week' ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-300'}`}
              onClick={() => setTopMode('week')}
            >
              Неделя
            </button>
            <button
              type="button"
              className={`text-xs px-3 py-1.5 rounded-lg ${topMode === 'month' ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-300'}`}
              onClick={() => { setTopMode('month'); setMonthCursor(viewDate) }}
            >
              Месяц
            </button>
          </div>
        </div>

        {topMode === 'week' ? (
          <div className="flex gap-1.5">
            {weekMarks.map(mark => {
              const isToday = mark.date === todayYmd
              const isSelected = mark.date === viewDate
              const weekLabel = mark.total === 0 ? 'нет привычек' : `${mark.done}/${mark.total}`
              const fillPct = mark.total === 0 ? 0 : Math.round((mark.done / mark.total) * 100)
              return (
                <button
                  key={mark.date}
                  type="button"
                  onClick={() => setViewDate(mark.date)}
                  className="flex-1 flex flex-col items-center gap-1.5 min-w-0 rounded-lg py-1 -my-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                  aria-pressed={isSelected}
                  aria-label={`${mark.short}, ${mark.date}${isToday ? ', сегодня' : ''}${isSelected ? ', выбрано' : ''}, ${weekLabel}`}
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
                      boxShadow: isSelected
                        ? '0 0 0 2px rgba(127,119,221,0.75)'
                        : isToday
                          ? '0 0 0 1px rgba(127,119,221,0.5)'
                          : undefined,
                    }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      initial={false}
                      animate={{
                        width: `${fillPct}%`,
                        backgroundColor: mark.total === 0 ? 'transparent' : mark.done > 0 ? '#22c55e' : 'transparent',
                      }}
                      transition={{ duration: 0.35 }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300"
                onClick={() => {
                  const d = ymdToDate(monthCursor)
                  d.setMonth(d.getMonth() - 1)
                  setMonthCursor(ymdFromDate(d))
                }}
              >
                ←
              </button>
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300"
                onClick={() => setMonthCursor(todayYmd)}
              >
                Сегодня
              </button>
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300"
                onClick={() => {
                  const d = ymdToDate(monthCursor)
                  d.setMonth(d.getMonth() + 1)
                  setMonthCursor(ymdFromDate(d))
                }}
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {(() => {
                const d = ymdToDate(monthCursor)
                const first = new Date(d.getFullYear(), d.getMonth(), 1)
                const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
                const firstIso = isoWeekdayFromDate(first) // 1..7
                const padBefore = firstIso - 1
                const cells: Array<{ ymd: string; inMonth: boolean }> = []
                for (let i = 0; i < padBefore; i++) {
                  const x = new Date(first)
                  x.setDate(x.getDate() - (padBefore - i))
                  cells.push({ ymd: ymdFromDate(x), inMonth: false })
                }
                for (let day = 1; day <= last.getDate(); day++) {
                  const x = new Date(d.getFullYear(), d.getMonth(), day)
                  cells.push({ ymd: ymdFromDate(x), inMonth: true })
                }
                while (cells.length % 7 !== 0) {
                  const x = ymdToDate(cells[cells.length - 1]?.ymd ?? ymdFromDate(last))
                  x.setDate(x.getDate() + 1)
                  cells.push({ ymd: ymdFromDate(x), inMonth: false })
                }
                return cells.map(c => {
                  const m = monthMarks[c.ymd] ?? { done: 0, total: 0 }
                  const isSelected = c.ymd === viewDate
                  const isToday = c.ymd === todayYmd
                  const pct = m.total === 0 ? 0 : Math.round((m.done / m.total) * 100)
                  const bg = m.total === 0 ? 'rgba(255,255,255,0.04)' : `rgba(34,197,94,${Math.min(0.45, 0.08 + pct / 300)})`
                  return (
                    <button
                      key={c.ymd}
                      type="button"
                      onClick={() => { setViewDate(c.ymd); setTopMode('week') }}
                      className="rounded-xl p-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                      style={{
                        background: bg,
                        border: `1px solid ${
                          isSelected ? 'rgba(127,119,221,0.65)' : isToday ? 'rgba(127,119,221,0.35)' : 'rgba(255,255,255,0.08)'
                        }`,
                        opacity: c.inMonth ? 1 : 0.45,
                      }}
                      aria-label={`${c.ymd}, ${m.total === 0 ? 'нет привычек' : `${m.done}/${m.total}`}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs tabular-nums ${c.inMonth ? 'text-gray-200' : 'text-gray-500'}`}>
                          {Number(c.ymd.split('-')[2])}
                        </span>
                        {m.total > 0 && (
                          <span className="text-[10px] text-gray-200/80 tabular-nums">
                            {m.done}/{m.total}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              })()}
            </div>
          </>
        )}
      </div>

      {/* Insights */}
      {!loading && habits.length > 0 && (
        <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs text-gray-500 mb-3">Инсайты (28 дней)</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3 bg-white/5 border border-white/10">
              <p className="text-[10px] text-gray-500">Стабильность</p>
              <p className="text-lg font-bold text-white tabular-nums">{insights.stabilityPct}%</p>
              <p className="text-[10px] text-gray-500 tabular-nums">{insights.totalDone}/{insights.totalPlanned}</p>
            </div>
            <div className="rounded-2xl p-3 bg-white/5 border border-white/10">
              <p className="text-[10px] text-gray-500">Перегруз</p>
              <p className="text-lg font-bold text-white">
                {insights.overloadWeekday ? WEEKDAY_SHORT_RU[insights.overloadWeekday - 1] : '—'}
              </p>
              <p className="text-[10px] text-gray-500">самый плотный</p>
            </div>
            <div className="rounded-2xl p-3 bg-white/5 border border-white/10">
              <p className="text-[10px] text-gray-500">Срыв</p>
              <p className="text-lg font-bold text-white">
                {insights.weakWeekday ? WEEKDAY_SHORT_RU[insights.weakWeekday - 1] : '—'}
              </p>
              <p className="text-[10px] text-gray-500">самый слабый</p>
            </div>
          </div>
        </div>
      )}

      {/* Habits list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-8 space-y-3">
        {!loading && !canToggle && (
          <div
            className="rounded-xl px-3 py-2 text-sm text-gray-200/95 mb-2 flex items-center justify-between gap-3"
            style={{ background: 'rgba(127,119,221,0.12)', border: '1px solid rgba(127,119,221,0.22)' }}
          >
            <p className="leading-snug">
              Этот день — для просмотра. Отмечать можно сегодня{habitRetroDays > 0 ? ` и ещё за последние ${habitRetroDays} дн.` : '.'}
            </p>
            <button
              type="button"
              className="shrink-0 text-violet-300 underline underline-offset-2"
              onClick={() => setViewDate(todayYmd)}
            >
              На сегодня
            </button>
          </div>
        )}
        {!loading && canToggle && viewDate !== todayYmd && (
          <div
            className="rounded-xl px-3 py-2 text-sm text-gray-200/95 mb-2 flex items-center justify-between gap-3"
            style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.20)' }}
          >
            <p className="leading-snug">
              Можно отметить прошлые дни в окне ретро — без лишнего давления.
            </p>
            <button
              type="button"
              className="shrink-0 text-violet-300 underline underline-offset-2"
              onClick={() => setViewDate(todayYmd)}
            >
              На сегодня
            </button>
          </div>
        )}
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
            {habits.length === 0 && (
              <div className="mt-6 space-y-2 text-left max-w-sm mx-auto">
                <p className="text-xs text-gray-500 px-1">Быстрый старт</p>
                <button
                  type="button"
                  className="w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 bg-white/5 border border-white/10 text-white"
                  disabled={quickAddBusy}
                  onClick={() => void quickAdd('10 минут ясности', 'mind', [1, 2, 3, 4, 5])}
                >
                  <span className="font-semibold">10 минут ясности</span>
                  <span className="text-xs text-gray-500">Пн–Пт</span>
                </button>
                <button
                  type="button"
                  className="w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 bg-white/5 border border-white/10 text-white"
                  disabled={quickAddBusy}
                  onClick={() => void quickAdd('Тело в движении (15 минут)', 'body', [2, 4, 6])}
                >
                  <span className="font-semibold">Тело в движении (15 минут)</span>
                  <span className="text-xs text-gray-500">Вт/Чт/Сб</span>
                </button>
                <button
                  type="button"
                  className="w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 bg-white/5 border border-white/10 text-white"
                  disabled={quickAddBusy}
                  onClick={() => void quickAdd('Тихий якорь (2 минуты)', 'spirit', [...ALL_WEEKDAYS])}
                >
                  <span className="font-semibold">Тихий якорь (2 минуты)</span>
                  <span className="text-xs text-gray-500">Каждый день</span>
                </button>
                <button
                  type="button"
                  className="mt-2 w-full py-3 rounded-2xl font-semibold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  onClick={openNewHabitSheet}
                >
                  Создать свою
                </button>
              </div>
            )}
          </div>
        ) : (
          visibleHabits.map(habit => {
            const done = viewLogs[habit.id] ?? false
            const color = SPHERE_COLORS[habit.sphere as Sphere] ?? '#7F77DD'
            const SphereIc = SPHERE_ICON[habit.sphere as Sphere] ?? Brain
            const isSelected = selectedIds.has(habit.id)
            return (
              <motion.div
                key={habit.id}
                className="flex items-center gap-3 rounded-2xl pl-3 pr-2 py-3 min-h-[56px] cursor-pointer"
                style={{
                  background: selectMode
                    ? isSelected
                      ? 'rgba(127,119,221,0.16)'
                      : 'rgba(255,255,255,0.04)'
                    : done
                      ? `${color}12`
                      : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${
                    selectMode
                      ? isSelected
                        ? 'rgba(127,119,221,0.55)'
                        : 'rgba(255,255,255,0.08)'
                      : done
                        ? color + '33'
                        : 'rgba(255,255,255,0.08)'
                  }`,
                }}
                layout
                role={selectMode ? 'checkbox' : undefined}
                aria-checked={selectMode ? isSelected : undefined}
                onClick={() => (selectMode ? toggleSelected(habit.id) : navigate(`/habits/${habit.id}`))}
              >
                {selectMode && (
                  <div className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: isSelected ? '#7F77DD' : 'rgba(255,255,255,0.18)',
                      background: isSelected ? 'rgba(127,119,221,0.55)' : 'transparent',
                    }}
                  >
                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                )}
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
                    onClick={e => { e.stopPropagation(); openEditHabit(habit) }}
                    className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
                    aria-label="Изменить привычку"
                    disabled={selectMode}
                  >
                    <Pencil size={18} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(habit) }}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    aria-label="Удалить привычку"
                    disabled={selectMode}
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
                  onClick={e => {
                    e.stopPropagation()
                    if (!selectMode && canToggle) void handleToggle(habit.id)
                  }}
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: done ? color : 'rgba(255,255,255,0.06)',
                    borderColor: done ? color : 'rgba(255,255,255,0.12)',
                  }}
                  whileTap={!selectMode && canToggle ? { scale: 0.92 } : undefined}
                >
                  {done && <Check size={22} className="text-white" strokeWidth={2.5} />}
                </motion.button>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            className="fixed left-0 right-0 z-[85] px-4"
            style={{ bottom: bottomInset + 96 }}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
          >
            <div
              className="mx-auto max-w-md rounded-2xl p-3 flex items-center gap-2"
              style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 disabled:opacity-40"
                onClick={() => { setBulkSphere('mind'); setShowBulkSphere(true) }}
                disabled={bulkBusy}
              >
                Сфера
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 disabled:opacity-40"
                onClick={() => { setBulkWeekdays([...ALL_WEEKDAYS]); setShowBulkSchedule(true) }}
                disabled={bulkBusy}
              >
                Дни
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 disabled:opacity-40"
                onClick={() => void runBulkUpdate({ archived_at: new Date().toISOString() })}
                disabled={bulkBusy}
              >
                В архив
              </button>
              <button
                type="button"
                className="py-2.5 px-3 rounded-xl text-sm font-semibold text-white bg-red-600/80 disabled:opacity-40"
                onClick={() => void runBulkDelete()}
                disabled={bulkBusy}
                aria-label="Удалить выбранные"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk sphere modal */}
      <AnimatePresence>
        {showBulkSphere && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !bulkBusy && setShowBulkSphere(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-white">Сменить сферу</h2>
              <p className="text-sm text-gray-400 mt-2">Применится к {selectedIds.size} привычкам.</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {SPHERES.map(s => {
                  const active = bulkSphere === s
                  const col = SPHERE_COLORS[s]
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBulkSphere(s)}
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
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl font-medium text-gray-300 bg-white/10"
                  onClick={() => setShowBulkSphere(false)}
                  disabled={bulkBusy}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl font-semibold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  onClick={() => void runBulkUpdate({ sphere: bulkSphere })}
                  disabled={bulkBusy}
                >
                  Применить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk schedule modal */}
      <AnimatePresence>
        {showBulkSchedule && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !bulkBusy && setShowBulkSchedule(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-white">Сменить дни</h2>
              <p className="text-sm text-gray-400 mt-2">Применится к {selectedIds.size} привычкам.</p>
              <div className="flex flex-wrap gap-2 mt-4 mb-3">
                <button
                  type="button"
                  onClick={() => setBulkWeekdays([...ALL_WEEKDAYS])}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                >
                  Все дни
                </button>
                <button
                  type="button"
                  onClick={() => setBulkWeekdays([1, 2, 3, 4, 5])}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                >
                  Пн–Пт
                </button>
                <button
                  type="button"
                  onClick={() => setBulkWeekdays([6, 7])}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                >
                  Выходные
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {ALL_WEEKDAYS.map(d => {
                  const active = bulkWeekdays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setBulkWeekdays(prev => toggleWeekday(prev, d))}
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
              {bulkWeekdays.length === 0 && (
                <p className="text-xs text-amber-500/90 mb-2">Выбери хотя бы один день</p>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl font-medium text-gray-300 bg-white/10"
                  onClick={() => setShowBulkSchedule(false)}
                  disabled={bulkBusy}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl font-semibold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  onClick={() => void runBulkUpdate({ weekdays: bulkWeekdays })}
                  disabled={bulkBusy || bulkWeekdays.length === 0}
                >
                  Применить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retro settings modal */}
      <AnimatePresence>
        {showRetroSettings && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRetroSettings(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-white">Окно ретро-отметок</h2>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Сколько дней назад можно отмечать привычки. За ретро-дни XP не начисляется.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[0, 1, 7].map(v => (
                  <button
                    key={v}
                    type="button"
                    className="py-3 rounded-2xl text-sm font-semibold"
                    style={{
                      background: habitRetroDays === v ? 'rgba(127,119,221,0.35)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${habitRetroDays === v ? 'rgba(127,119,221,0.65)' : 'rgba(255,255,255,0.10)'}`,
                      color: habitRetroDays === v ? '#fff' : '#d1d5db',
                    }}
                    onClick={() => void updateHabitRetroDays(v)}
                  >
                    {v}д
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-5 w-full py-3 rounded-2xl font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                onClick={() => setShowRetroSettings(false)}
              >
                Готово
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
      <PaywallModal open={showPaywall} feature="habit_add" onClose={() => setShowPaywall(false)} />

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
