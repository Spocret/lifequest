import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Flame, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { useHabits } from '@/hooks/useLifeQuest'
import { SPHERE_COLORS, SPHERE_LABELS, type Sphere } from '@/types'

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
const WEEKDAY_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const
const SPHERES: Sphere[] = ['mind', 'body', 'spirit', 'resource']

function ymdFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function ymdMinusDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() - days)
  return ymdFromDate(d)
}

function toggleWeekday(prev: number[], d: number): number[] {
  const next = prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
  return next.sort((a, b) => a - b)
}

export default function HabitDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const {
    habits,
    updateHabit,
    deleteHabit,
    bulkUpdateHabits,
    loadHabitCompletionsInRange,
    getHabitReminder,
    setHabitReminderEnabled,
  } = useHabits()

  const habit = useMemo(() => habits.find(h => h.id === id) ?? null, [habits, id])
  const habitId = habit?.id ?? null
  const [history, setHistory] = useState<Set<string>>(() => new Set())
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(false)
  const [reminderBusy, setReminderBusy] = useState(false)

  const [name, setName] = useState('')
  const [sphere, setSphere] = useState<Sphere>('mind')
  const [weekdays, setWeekdays] = useState<number[]>([...ALL_WEEKDAYS])

  useEffect(() => {
    if (!habit) return
    setName(habit.name)
    setSphere(habit.sphere as Sphere)
    const w = habit.weekdays
    setWeekdays(Array.isArray(w) && w.length > 0 ? [...w] : [...ALL_WEEKDAYS])
  }, [habit])

  useEffect(() => {
    if (!habitId) return
    let cancelled = false
    const end = ymdFromDate(new Date())
    const start = ymdMinusDays(end, 89)
    void loadHabitCompletionsInRange(habitId, start, end).then(set => {
      if (!cancelled) setHistory(set)
    })
    return () => { cancelled = true }
  }, [habitId, loadHabitCompletionsInRange])

  useEffect(() => {
    if (!habitId) return
    let cancelled = false
    void getHabitReminder(habitId).then(r => {
      if (cancelled) return
      setReminderEnabled(Boolean(r?.enabled))
    })
    return () => { cancelled = true }
  }, [habitId, getHabitReminder])

  if (!habit) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-safe pb-4">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Привычка</h1>
        </div>
        <div className="px-4 text-gray-400">Не найдено.</div>
      </div>
    )
  }

  const color = SPHERE_COLORS[habit.sphere as Sphere] ?? '#7F77DD'
  const isArchived = Boolean(habit.archived_at)

  async function save() {
    if (!habitId) return
    const trimmed = name.trim()
    if (!trimmed || saving || weekdays.length === 0) return
    setSaving(true)
    try {
      await updateHabit(habitId, trimmed, sphere, weekdays)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function toggleArchive() {
    if (!habitId) return
    if (saving) return
    setSaving(true)
    try {
      await bulkUpdateHabits([habitId], { archived_at: isArchived ? null : new Date().toISOString() })
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!habitId) return
    const ok = window.confirm('Удалить привычку и все отметки выполнения без восстановления?')
    if (!ok) return
    setSaving(true)
    try {
      await deleteHabit(habitId)
      navigate('/habits')
    } finally {
      setSaving(false)
    }
  }

  async function toggleReminder() {
    if (reminderBusy || !habitId) return
    setReminderBusy(true)
    try {
      const next = !reminderEnabled
      await setHabitReminderEnabled(habitId, next)
      setReminderEnabled(next)
    } finally {
      setReminderBusy(false)
    }
  }

  const end = ymdFromDate(new Date())
  const days = Array.from({ length: 90 }, (_, i) => ymdMinusDays(end, 89 - i))

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-24">
      <div className="flex items-center gap-3 px-4 pt-safe pb-4">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white flex-1 truncate">{habit.name}</h1>
        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className="p-2 rounded-xl bg-white/5 text-gray-200"
          aria-label="Редактировать"
        >
          <Pencil size={18} />
        </button>
        <button
          type="button"
          onClick={() => void toggleArchive()}
          className="p-2 rounded-xl bg-white/5 text-gray-200 disabled:opacity-40"
          aria-label={isArchived ? 'Вернуть из архива' : 'В архив'}
          disabled={saving}
        >
          {isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          className="p-2 rounded-xl bg-red-600/20 text-red-200 disabled:opacity-40"
          aria-label="Удалить"
          disabled={saving}
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="px-4 space-y-4">
        <div className="rounded-2xl p-4" style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">Сфера</div>
            <div className="text-sm font-semibold" style={{ color }}>
              {SPHERE_LABELS[habit.sphere as Sphere] ?? habit.sphere}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-orange-400/95">
            <Flame size={16} />
            <span className="text-sm font-semibold tabular-nums">{habit.streak}</span>
            <span className="text-xs text-gray-500">стрик</span>
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Напоминание</p>
              <p className="text-xs text-gray-500 mt-0.5">В бесплатном Vercel: 10:05 МСК (через бот)</p>
            </div>
            <button
              type="button"
              onClick={() => void toggleReminder()}
              disabled={reminderBusy}
              className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
              style={{
                background: reminderEnabled ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${reminderEnabled ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.10)'}`,
                color: reminderEnabled ? '#bbf7d0' : '#d1d5db',
              }}
            >
              {reminderBusy ? '…' : reminderEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {editing && (
          <motion.div
            className="rounded-2xl p-4 space-y-4"
            style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)' }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Название</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent/50"
              />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Сфера</p>
              <div className="grid grid-cols-2 gap-2">
                {SPHERES.map(s => {
                  const active = sphere === s
                  const col = SPHERE_COLORS[s]
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSphere(s)}
                      className="py-3 px-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center"
                      style={{
                        background: active ? col + '28' : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${active ? col : 'transparent'}`,
                        color: active ? col : '#9ca3af',
                      }}
                    >
                      {SPHERE_LABELS[s]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Дни недели</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setWeekdays([...ALL_WEEKDAYS])}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                >
                  Все дни
                </button>
                <button
                  type="button"
                  onClick={() => setWeekdays([1, 2, 3, 4, 5])}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                >
                  Пн–Пт
                </button>
                <button
                  type="button"
                  onClick={() => setWeekdays([6, 7])}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300"
                >
                  Выходные
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {ALL_WEEKDAYS.map(d => {
                  const active = weekdays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setWeekdays(prev => toggleWeekday(prev, d))}
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
              {weekdays.length === 0 && (
                <p className="text-xs text-amber-500/90 mt-2">Выбери хотя бы один день</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => void save()}
              disabled={!name.trim() || saving || weekdays.length === 0}
              className="w-full py-3 rounded-2xl font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </motion.div>
        )}

        <div className="rounded-2xl p-4" style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">История (90 дней)</p>
            <p className="text-xs text-gray-500">тап = открыть день</p>
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {days.map(d => {
              const done = history.has(d)
              return (
                <button
                  key={d}
                  type="button"
                  className="h-7 rounded-lg border flex items-center justify-center"
                  style={{
                    background: done ? `${color}33` : 'rgba(255,255,255,0.04)',
                    borderColor: done ? `${color}66` : 'rgba(255,255,255,0.08)',
                  }}
                  onClick={() => navigate(`/habits?date=${d}`)}
                  aria-label={`${d}: ${done ? 'выполнено' : 'нет'}`}
                >
                  {done && <Check size={14} style={{ color }} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

