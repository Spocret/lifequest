import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  createElement,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { getPlanStatus, canUse } from '@/lib/access'
import { getReferralStats, activateReferral } from '@/lib/referral'
import type {
  User, Character, JournalEntry, Habit,
  Quest, FeatureKey, PlanStatus, ReferralStats
} from '@/types'
import { isHabitScheduledForDate, localYmd } from '@/lib/date'
import { supabaseErrorMessage } from '@/lib/supabaseError'

/** Matches onboarding first quest title (`Onboarding.insertFirstQuest`). */
const FIRST_JOURNAL_QUEST_TITLE = 'Один честный ответ'

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

export function useTelegramUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const tg = window.Telegram?.WebApp
        if (!tg?.initDataUnsafe?.user) throw new Error('Not in Telegram')
        const tgUser = tg.initDataUnsafe.user

        const { data, error } = await supabase
          .from('users')
          .upsert({ tg_id: tgUser.id, tg_username: tgUser.username }, { onConflict: 'tg_id' })
          .select()
          .single()

        if (error) throw error
        setUser(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Auth failed')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  return { user, loading, error }
}

// ─────────────────────────────────────────────────────────────
// CHARACTER
// ─────────────────────────────────────────────────────────────

export function useCharacter(userId: string | undefined) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', userId)
        .single()
      if (error) throw error
      setCharacter(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load character')
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('characters')
          .select('*')
          .eq('user_id', userId)
          .single()
        if (error) throw error
        if (!cancelled) setCharacter(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load character')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetch()
    return () => {
      cancelled = true
    }
  }, [userId])

  const gainXP = useCallback(async (amount: number, stat?: keyof Pick<Character, 'mind' | 'body' | 'spirit' | 'resource'>, statAmount = 2) => {
    let char = character
    if (!char && userId) {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', userId)
        .single()
      if (error || !data) return
      char = data
    }
    if (!char) return
    const updates: Partial<Character> = {
      xp: char.xp + amount,
      last_active: new Date().toISOString(),
    }
    if (stat) updates[stat] = (char[stat] as number) + statAmount

    const newXP = updates.xp as number
    const currentLevel = char.level
    const newLevel = calculateLevel(newXP)
    if (newLevel > currentLevel) updates.level = newLevel

    const { data, error } = await supabase
      .from('characters')
      .update(updates)
      .eq('id', char.id)
      .select()
      .single()

    if (!error && data) {
      setCharacter(data)
      return { levelUp: newLevel > currentLevel, newLevel }
    }
  }, [character, userId])

  const revealCharacter = useCallback(async () => {
    if (!character) return
    const { data } = await supabase
      .from('characters')
      .update({ avatar_state: 'revealed' })
      .eq('id', character.id)
      .select()
      .single()
    if (data) setCharacter(data)
  }, [character])

  /** First journal entry: mark onboarding quest complete, +150 XP, avatar revealed. Reads fresh XP from DB. */
  const completeFirstJournalReveal = useCallback(async () => {
    if (!character) return
    const { data: fresh, error: fetchErr } = await supabase
      .from('characters')
      .select('*')
      .eq('id', character.id)
      .single()
    if (fetchErr || !fresh) return

    const { data: quest } = await supabase
      .from('quests')
      .select('id')
      .eq('user_id', character.user_id)
      .eq('status', 'active')
      .eq('title', FIRST_JOURNAL_QUEST_TITLE)
      .maybeSingle()

    if (quest) {
      await supabase.from('quests').update({ status: 'completed' }).eq('id', quest.id)
    }

    const newXP = fresh.xp + 150
    const newLevel = calculateLevel(newXP)
    const updates: Partial<Character> = {
      avatar_state: 'revealed',
      xp: newXP,
      last_active: new Date().toISOString(),
    }
    if (newLevel > fresh.level) updates.level = newLevel

    const { data, error } = await supabase
      .from('characters')
      .update(updates)
      .eq('id', character.id)
      .select()
      .single()

    if (!error && data) {
      setCharacter(data)
      void activateReferral(character.user_id)
    }
  }, [character])

  return { character, loading, error, gainXP, revealCharacter, completeFirstJournalReveal, refetch }
}

function calculateLevel(xp: number): number {
  const thresholds = [0, 500, 1500, 4000, 9000, 18000, 35000, 70000]
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]) return i + 1
  }
  return 1
}

export function useXPProgress(xp: number, level: number) {
  const thresholds = [0, 500, 1500, 4000, 9000, 18000, 35000, 70000, Infinity]
  const current = thresholds[level - 1] ?? 0
  const next = thresholds[level] ?? thresholds[thresholds.length - 2]
  const progress = Math.round(((xp - current) / (next - current)) * 100)
  const xpToNext = next - xp
  return { progress: Math.min(progress, 100), xpToNext, currentThreshold: current, nextThreshold: next }
}

// ─────────────────────────────────────────────────────────────
// JOURNAL
// ─────────────────────────────────────────────────────────────

export function useJournal(userId: string | undefined) {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    async function fetch() {
      const uid = userId as string
      try {
        const status = await getPlanStatus(uid)
        let q = supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
        if (status.plan === 'free') {
          const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
          q = q.gte('created_at', since)
        }
        const { data, error } = await q.limit(50)
        if (error) throw error
        setEntries(data ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load entries')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [userId])

  const addEntry = useCallback(async (content: string, aiResponse?: string, sphere?: string) => {
    if (!userId) return null
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({ user_id: userId, content, ai_response: aiResponse, sphere, xp_gained: 50 })
      .select()
      .single()
    if (error) {
      throw new Error(supabaseErrorMessage(error, 'Ошибка записи в дневник'))
    }
    setEntries(prev => [data, ...prev])
    return data
  }, [userId])

  const updateEntryAi = useCallback(async (id: string, ai_response: string) => {
    if (!userId) return
    const { error } = await supabase
      .from('journal_entries')
      .update({ ai_response })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) {
      throw new Error(supabaseErrorMessage(error, 'Не удалось обновить ответ наставника'))
    }
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ai_response } : e)))
  }, [userId])

  const monthlyCount = entries.filter(e => {
    const entryDate = new Date(e.created_at)
    const now = new Date()
    return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear()
  }).length

  return { entries, loading, error, addEntry, updateEntryAi, monthlyCount, isFirstEntry: entries.length === 0 }
}

// ─────────────────────────────────────────────────────────────
// HABITS
// ─────────────────────────────────────────────────────────────

const WEEK_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

/** Local calendar YYYY-MM-DD for Mon–Sun of the week containing `ref`. */
export function getWeekMonSunDates(ref = new Date()): string[] {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + mondayOffset)
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)
    const y = x.getFullYear()
    const m = String(x.getMonth() + 1).padStart(2, '0')
    const dd = String(x.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${dd}`)
  }
  return out
}

export type HabitToggleResult = {
  completed: boolean
  habit: Habit | null
  streakBonus: boolean
  date: string
  isRetro: boolean
  xpAwarded: number
}

export type WeekDayMark = {
  short: string
  date: string
  done: number
  total: number
  filled: boolean
}

export type DayMark = {
  date: string
  done: number
  total: number
}

function initialWeekMarks(): WeekDayMark[] {
  const dates = getWeekMonSunDates()
  return dates.map((date, i) => ({ short: WEEK_SHORT_RU[i], date, done: 0, total: 0, filled: false }))
}

const DEFAULT_WEEKDAYS: number[] = [1, 2, 3, 4, 5, 6, 7]

/** Minimal columns for old DBs (no weekdays / cache issues). No created_at — not all projects have it. */
const HABIT_COLUMNS_MINIMAL =
  'id, user_id, name, sphere, frequency, streak, last_done'

const HABIT_COLUMNS_LEGACY = `${HABIT_COLUMNS_MINIMAL}, weekdays`
const HABIT_COLUMNS_V2 = `${HABIT_COLUMNS_LEGACY}, archived_at, sort_order, created_at`

function normalizeHabitRow(row: Habit): Habit {
  const w = row.weekdays
  const weekdays =
    Array.isArray(w) && w.length > 0 ? w.map(n => Number(n)) : DEFAULT_WEEKDAYS
  return {
    ...row,
    weekdays,
    created_at: row.created_at ?? '',
    archived_at: row.archived_at ?? null,
    sort_order: row.sort_order ?? null,
  }
}

function ymdMinusDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

async function recomputeStreakFromLogs(habit: Habit): Promise<{ streak: number; last_done: string | null }> {
  const todayStr = localYmd()
  const start = ymdMinusDays(todayStr, 120)
  const { data, error } = await supabase
    .from('habit_logs')
    .select('date')
    .eq('habit_id', habit.id)
    .eq('completed', true)
    .gte('date', start)
    .lte('date', todayStr)
    .order('date', { ascending: false })

  if (error) {
    console.error('recompute streak:', error)
    return { streak: habit.streak, last_done: habit.last_done }
  }

  const completed = new Set((data ?? []).map(r => r.date as string))
  const lastDone = (data?.[0]?.date as string | undefined) ?? null
  if (!lastDone) return { streak: 0, last_done: null }

  let streak = 0
  let cur = lastDone
  while (true) {
    if (!isHabitScheduledForDate(habit, cur)) {
      cur = ymdMinusDays(cur, 1)
      continue
    }
    if (completed.has(cur)) {
      streak += 1
      cur = ymdMinusDays(cur, 1)
      continue
    }
    break
  }

  return { streak, last_done: lastDone }
}

function useHabitsInternal(userId: string | undefined) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<Record<string, boolean>>({})
  const [completionCounts, setCompletionCounts] = useState<Record<string, number>>({})
  const [weekMarks, setWeekMarks] = useState<WeekDayMark[]>(initialWeekMarks)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [habitRetroDays, setHabitRetroDays] = useState(1)

  const fetchSeq = useRef(0)

  const fetchWeekMarks = useCallback(
    async (habitList: Habit[]) => {
      const dates = getWeekMonSunDates()
      if (habitList.length === 0) {
        setWeekMarks(dates.map((date, i) => ({ short: WEEK_SHORT_RU[i], date, done: 0, total: 0, filled: false })))
        return
      }
      const ids = habitList.map(h => h.id)
      const { data, error } = await supabase
        .from('habit_logs')
        .select('date, habit_id')
        .in('habit_id', ids)
        .eq('completed', true)
        .gte('date', dates[0])
        .lte('date', dates[6])
      if (error) {
        console.error('week marks:', error)
        setWeekMarks(dates.map((date, i) => ({ short: WEEK_SHORT_RU[i], date, done: 0, total: 0, filled: false })))
        return
      }
      const completedByDate = new Map<string, Set<string>>()
      ;(data ?? []).forEach(r => {
        const dt = r.date as string
        const hid = r.habit_id as string
        const set = completedByDate.get(dt) ?? new Set<string>()
        set.add(hid)
        completedByDate.set(dt, set)
      })
      setWeekMarks(
        dates.map((date, i) => ({
          short: WEEK_SHORT_RU[i],
          date,
          total: habitList.filter(h => isHabitScheduledForDate(h, date)).length,
          done: habitList.filter(h => isHabitScheduledForDate(h, date) && (completedByDate.get(date)?.has(h.id) ?? false)).length,
          filled: (completedByDate.get(date)?.size ?? 0) > 0,
        })),
      )
    },
    [],
  )

  const fetchRangeMarks = useCallback(async (habitList: Habit[], startYmd: string, endYmd: string): Promise<DayMark[]> => {
    if (habitList.length === 0) return []
    const ids = habitList.map(h => h.id)
    const { data, error } = await supabase
      .from('habit_logs')
      .select('date, habit_id')
      .in('habit_id', ids)
      .eq('completed', true)
      .gte('date', startYmd)
      .lte('date', endYmd)
    if (error) {
      console.error('range marks:', error)
      return []
    }
    const completedByDate = new Map<string, Set<string>>()
    ;(data ?? []).forEach(r => {
      const dt = r.date as string
      const hid = r.habit_id as string
      const set = completedByDate.get(dt) ?? new Set<string>()
      set.add(hid)
      completedByDate.set(dt, set)
    })

    const out: DayMark[] = []
    const cur = new Date(startYmd + 'T12:00:00')
    const end = new Date(endYmd + 'T12:00:00')
    while (cur <= end) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      const date = `${y}-${m}-${d}`
      const total = habitList.filter(h => isHabitScheduledForDate(h, date)).length
      const done = habitList.filter(h => isHabitScheduledForDate(h, date) && (completedByDate.get(date)?.has(h.id) ?? false)).length
      out.push({ date, done, total })
      cur.setDate(cur.getDate() + 1)
    }
    return out
  }, [])

  const loadLogsForDate = useCallback(async (dateStr: string, habitIds: string[]) => {
    if (!userId || habitIds.length === 0) return {}
    const { data, error: qErr } = await supabase
      .from('habit_logs')
      .select('habit_id, completed')
      .eq('date', dateStr)
      .in('habit_id', habitIds)
    if (qErr) {
      console.error('habit_logs:', qErr)
      return {}
    }
    const logs: Record<string, boolean> = {}
    data?.forEach(l => {
      logs[l.habit_id] = l.completed
    })
    return logs
  }, [userId])

  const loadHabitCompletionsInRange = useCallback(async (habitId: string, startYmd: string, endYmd: string) => {
    if (!userId) return new Set<string>()
    const { data, error } = await supabase
      .from('habit_logs')
      .select('date')
      .eq('habit_id', habitId)
      .eq('completed', true)
      .gte('date', startYmd)
      .lte('date', endYmd)
    if (error) {
      console.error('habit history:', error)
      return new Set<string>()
    }
    return new Set((data ?? []).map(r => r.date as string))
  }, [userId])

  const fetchHabits = useCallback(async () => {
    if (!userId) return
    const seq = ++fetchSeq.current
    const todayStr = localYmd()
    setLoading(true)
    setError(null)
    try {
      // Best-effort: read retro window setting (defaults to 1 if missing).
      try {
        const { data: settings } = await supabase
          .from('users')
          .select('habit_retro_days')
          .eq('id', userId)
          .maybeSingle()
        const v = Number(settings?.habit_retro_days)
        if (Number.isFinite(v) && v >= 0 && v <= 30) setHabitRetroDays(v)
      } catch {
        // ignore (schema cache / column missing)
      }

      let habitsRes = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('id')
      if (seq !== fetchSeq.current) return
      if (habitsRes.error) {
        const hint = supabaseErrorMessage(habitsRes.error, '')
        const looksLikeColumns = /weekdays|archived_at|sort_order|created_at/i.test(hint) || /schema cache/i.test(hint)
        if (looksLikeColumns) {
          habitsRes = await supabase
            .from('habits')
            .select(HABIT_COLUMNS_V2)
            .eq('user_id', userId)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('id')
          if (seq !== fetchSeq.current) return
          if (habitsRes.error) {
            const h2 = supabaseErrorMessage(habitsRes.error, '')
            if (/archived_at|sort_order|created_at/i.test(h2) || /schema cache/i.test(h2)) {
              habitsRes = await supabase
                .from('habits')
                .select(HABIT_COLUMNS_MINIMAL)
                .eq('user_id', userId)
                .order('id')
              if (seq !== fetchSeq.current) return
            }
          }
        }
      }
      if (habitsRes.error) throw habitsRes.error
      const listAll = (habitsRes.data ?? []).map(normalizeHabitRow)
      const list = showArchived ? listAll : listAll.filter(h => !h.archived_at)
      setHabits(list)

      const ids = list.map(h => h.id)
      const logs: Record<string, boolean> = {}
      if (ids.length > 0) {
        const { data: logRows, error: logsErr } = await supabase
          .from('habit_logs')
          .select('habit_id, completed')
          .eq('date', todayStr)
          .in('habit_id', ids)
        if (seq !== fetchSeq.current) return
        if (logsErr) {
          console.error('habit_logs (today):', logsErr)
        } else {
          logRows?.forEach(l => {
            logs[l.habit_id] = l.completed
          })
        }
      }
      setTodayLogs(logs)

      if (ids.length > 0) {
        const { data: countRows, error: countErr } = await supabase
          .from('habit_logs')
          .select('habit_id')
          .eq('completed', true)
          .in('habit_id', ids)
        if (seq !== fetchSeq.current) return
        if (!countErr && countRows) {
          const c: Record<string, number> = {}
          countRows.forEach(r => {
            c[r.habit_id] = (c[r.habit_id] ?? 0) + 1
          })
          setCompletionCounts(c)
        }
      } else {
        setCompletionCounts({})
      }

      await fetchWeekMarks(list)
    } catch (e) {
      if (seq !== fetchSeq.current) return
      console.error('Failed to load habits:', e)
      setError(supabaseErrorMessage(e, 'Не удалось загрузить привычки'))
    } finally {
      if (seq !== fetchSeq.current) return
      setLoading(false)
    }
  }, [userId, fetchWeekMarks, showArchived])

  useEffect(() => {
    void fetchHabits()
    return () => {
      fetchSeq.current++
    }
  }, [fetchHabits])

  // Telegram Mini App: first request may fail while WebView wakes up; reload when returning from background.
  useEffect(() => {
    let wasHidden = false
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true
        return
      }
      if (document.visibilityState === 'visible' && wasHidden && userId) {
        wasHidden = false
        void fetchHabits()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [userId, fetchHabits])

  const toggleHabit = useCallback(
    async (habitId: string, dateStr?: string): Promise<HabitToggleResult> => {
      const habit = habits.find(h => h.id === habitId) ?? null
      const todayStr = localYmd()
      if (!habit) return { completed: false, habit: null, streakBonus: false, date: dateStr ?? todayStr, isRetro: false, xpAwarded: 0 }

      const targetDate = dateStr ?? todayStr
      const isToday = targetDate === todayStr
      const earliest = ymdMinusDays(todayStr, habitRetroDays)
      const targetMs = new Date(targetDate + 'T12:00:00').getTime()
      const earliestMs = new Date(earliest + 'T12:00:00').getTime()
      const todayMs = new Date(todayStr + 'T12:00:00').getTime()
      const withinWindow = targetMs >= earliestMs && targetMs <= todayMs
      const isRetro = !isToday && withinWindow
      if (!withinWindow) {
        return { completed: false, habit, streakBonus: false, date: targetDate, isRetro: false, xpAwarded: 0 }
      }
      if (!isHabitScheduledForDate(habit, targetDate)) {
        return { completed: false, habit, streakBonus: false, date: targetDate, isRetro, xpAwarded: 0 }
      }

      const isDone = isToday ? todayLogs[habitId] : undefined
      const prevLogs = { ...todayLogs }
      const prevHabits = habits.map(h => ({ ...h }))

      if (isToday) {
        setTodayLogs(prev => ({ ...prev, [habitId]: !isDone }))
      }

      try {
        const currentlyDone = isToday
          ? Boolean(isDone)
          : Boolean((await loadLogsForDate(targetDate, [habitId]))[habitId])

        if (currentlyDone) {
          await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', targetDate)

          const { data: prevRow } = await supabase
            .from('habit_logs')
            .select('date')
            .eq('habit_id', habitId)
            .eq('completed', true)
            .neq('date', targetDate)
            .order('date', { ascending: false })
            .limit(1)

          let updated: Habit
          if (isRetro) {
            const recomputed = await recomputeStreakFromLogs(habit)
            await supabase
              .from('habits')
              .update({ streak: recomputed.streak, last_done: recomputed.last_done })
              .eq('id', habitId)
            updated = { ...habit, streak: recomputed.streak, last_done: recomputed.last_done }
          } else {
            const newLastDone = (prevRow?.[0]?.date as string | undefined) ?? null
            const newStreak = Math.max(0, habit.streak - 1)
            await supabase
              .from('habits')
              .update({ streak: newStreak, last_done: newLastDone })
              .eq('id', habitId)
            updated = { ...habit, streak: newStreak, last_done: newLastDone }
          }
          setHabits(prev => prev.map(h => (h.id === habitId ? updated : h)))
          setCompletionCounts(prev => ({
            ...prev,
            [habitId]: Math.max(0, (prev[habitId] ?? 0) - 1),
          }))
          await fetchWeekMarks(habits.map(h => (h.id === habitId ? updated : h)))
          if (isToday) {
            setTodayLogs(prev => ({ ...prev, [habitId]: false }))
          }
          return { completed: false, habit: updated, streakBonus: false, date: targetDate, isRetro, xpAwarded: 0 }
        }

        await supabase.from('habit_logs').upsert({ habit_id: habitId, date: targetDate, completed: true })

        let updated: Habit
        let streakBonus = false
        if (isRetro) {
          const recomputed = await recomputeStreakFromLogs(habit)
          await supabase
            .from('habits')
            .update({ streak: recomputed.streak, last_done: recomputed.last_done })
            .eq('id', habitId)
          updated = { ...habit, streak: recomputed.streak, last_done: recomputed.last_done }
        } else {
          const yStr = ymdMinusDays(todayStr, 1)
          let newStreak: number
          if (habit.last_done === null) {
            newStreak = 1
          } else if (habit.last_done === yStr) {
            newStreak = habit.streak + 1
          } else if (habit.last_done === todayStr) {
            newStreak = habit.streak
          } else {
            newStreak = 1
          }

          await supabase
            .from('habits')
            .update({ streak: newStreak, last_done: todayStr })
            .eq('id', habitId)

          updated = { ...habit, streak: newStreak, last_done: todayStr }
          streakBonus = newStreak > 0 && newStreak % 7 === 0
        }

        setHabits(prev => prev.map(h => (h.id === habitId ? updated : h)))
        setCompletionCounts(prev => ({
          ...prev,
          [habitId]: (prev[habitId] ?? 0) + 1,
        }))
        await fetchWeekMarks(habits.map(h => (h.id === habitId ? updated : h)))
        if (isToday) {
          setTodayLogs(prev => ({ ...prev, [habitId]: true }))
        }
        const xpAwarded = isRetro ? 0 : 30
        return { completed: true, habit: updated, streakBonus, date: targetDate, isRetro, xpAwarded }
      } catch (e) {
        console.error(e)
        setTodayLogs(prevLogs)
        setHabits(prevHabits)
        return { completed: false, habit, streakBonus: false, date: dateStr ?? localYmd(), isRetro: false, xpAwarded: 0 }
      }
    },
    [habits, todayLogs, fetchWeekMarks, loadLogsForDate, habitRetroDays],
  )

  const addHabit = useCallback(
    async (name: string, sphere: string, weekdays: number[]) => {
      if (!userId) return
      const { data, error } = await supabase
        .from('habits')
        .insert({
          user_id: userId,
          name,
          sphere,
          frequency: 'daily',
          weekdays,
        })
        .select()
        .single()
      if (error) throw error
      const row = normalizeHabitRow(data as Habit)
      setHabits(prev => {
        const next = [...prev, row]
        void fetchWeekMarks(next)
        return next
      })
      void fetchHabits()
      return row
    },
    [userId, fetchWeekMarks, fetchHabits],
  )

  const updateHabit = useCallback(
    async (habitId: string, name: string, sphere: string, weekdays: number[]) => {
      if (!userId) return
      const { data, error } = await supabase
        .from('habits')
        .update({ name, sphere, frequency: 'daily', weekdays })
        .eq('id', habitId)
        .eq('user_id', userId)
        .select()
        .single()
      if (error) throw error
      const row = normalizeHabitRow(data as Habit)
      setHabits(prev => {
        const next = prev.map(h => (h.id === habitId ? row : h))
        void fetchWeekMarks(next)
        return next
      })
      void fetchHabits()
      return row
    },
    [userId, fetchWeekMarks, fetchHabits],
  )

  const bulkUpdateHabits = useCallback(async (habitIds: string[], patch: Partial<Pick<Habit, 'sphere' | 'weekdays' | 'archived_at' | 'sort_order'>>) => {
    if (!userId) return
    if (habitIds.length === 0) return
    const { error } = await supabase
      .from('habits')
      .update(patch)
      .in('id', habitIds)
      .eq('user_id', userId)
    if (error) throw error
    void fetchHabits()
  }, [userId, fetchHabits])

  const bulkDeleteHabits = useCallback(async (habitIds: string[]) => {
    if (!userId) return
    if (habitIds.length === 0) return
    const { error: logErr } = await supabase.from('habit_logs').delete().in('habit_id', habitIds)
    if (logErr) throw logErr
    const { error: habErr } = await supabase
      .from('habits')
      .delete()
      .in('id', habitIds)
      .eq('user_id', userId)
    if (habErr) throw habErr
    void fetchHabits()
  }, [userId, fetchHabits])

  const updateHabitRetroDays = useCallback(async (days: number) => {
    if (!userId) return
    const clamped = Math.max(0, Math.min(30, Math.floor(days)))
    setHabitRetroDays(clamped)
    try {
      const { error } = await supabase
        .from('users')
        .update({ habit_retro_days: clamped })
        .eq('id', userId)
      if (error) throw error
    } catch (e) {
      console.error('update habit retro days:', e)
      // Best-effort revert by refetching settings on next fetchHabits.
    }
  }, [userId])

  const getHabitReminder = useCallback(async (habitId: string): Promise<{ enabled: boolean } | null> => {
    if (!userId) return null
    const { data, error } = await supabase
      .from('habit_reminders')
      .select('enabled')
      .eq('habit_id', habitId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.error('get habit reminder:', error)
      return null
    }
    if (!data) return { enabled: false }
    return { enabled: (data as any).enabled !== false }
  }, [userId])

  const setHabitReminderEnabled = useCallback(async (habitId: string, enabled: boolean) => {
    if (!userId) return
    const { data: u } = await supabase.from('users').select('tg_id').eq('id', userId).maybeSingle()
    const tgId = Number((u as any)?.tg_id)
    if (!Number.isFinite(tgId)) throw new Error('tg_id missing')
    const { error } = await supabase
      .from('habit_reminders')
      .upsert({
        user_id: userId,
        habit_id: habitId,
        tg_id: tgId,
        enabled,
        // Hobby Vercel cron: bot-tick runs daily at 07:05 UTC (~10:05 MSK).
        fire_hour_utc: 7,
        fire_minute_utc: 5,
      }, { onConflict: 'habit_id' })
    if (error) throw error
  }, [userId])

  const deleteHabit = useCallback(
    async (habitId: string) => {
      if (!userId) return
      const { error: logErr } = await supabase.from('habit_logs').delete().eq('habit_id', habitId)
      if (logErr) throw logErr
      const { error: habErr } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', userId)
      if (habErr) throw habErr
      setHabits(prev => {
        const next = prev.filter(h => h.id !== habitId)
        void fetchWeekMarks(next)
        return next
      })
      setTodayLogs(prev => {
        const n = { ...prev }
        delete n[habitId]
        return n
      })
      setCompletionCounts(prev => {
        const n = { ...prev }
        delete n[habitId]
        return n
      })
      void fetchHabits()
    },
    [userId, fetchWeekMarks, fetchHabits],
  )

  return {
    habits,
    todayLogs,
    completionCounts,
    weekMarks,
    loading,
    error,
    showArchived,
    setShowArchived,
    habitRetroDays,
    updateHabitRetroDays,
    getHabitReminder,
    setHabitReminderEnabled,
    toggleHabit,
    addHabit,
    updateHabit,
    bulkUpdateHabits,
    bulkDeleteHabits,
    deleteHabit,
    loadLogsForDate,
    loadHabitCompletionsInRange,
    fetchRangeMarks,
    refetch: fetchHabits,
  }
}

// ─────────────────────────────────────────────────────────────
// HABITS CONTEXT (shared across tabs — survives route changes)
// ─────────────────────────────────────────────────────────────

export type HabitsContextValue = ReturnType<typeof useHabitsInternal>

const HabitsContext = createContext<HabitsContextValue | null>(null)

export function HabitsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const value = useHabitsInternal(userId)
  return createElement(HabitsContext.Provider, { value }, children)
}

export function useHabits() {
  const ctx = useContext(HabitsContext)
  if (!ctx) throw new Error('useHabits must be used within HabitsProvider')
  return ctx
}

// ─────────────────────────────────────────────────────────────
// QUESTS
// ─────────────────────────────────────────────────────────────

export function useQuests(userId: string | undefined) {
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQuests = useCallback(async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('quests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      setQuests(data ?? [])
    } catch (e) {
      console.error('Failed to load quests:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    setLoading(true)
    void fetchQuests()
  }, [fetchQuests])

  const completeQuest = useCallback(async (questId: string): Promise<{ xp: number; quest: Quest | null }> => {
    const quest = quests.find(q => q.id === questId)
    if (!quest) return { xp: 0, quest: null }
    setQuests(prev => prev.filter(q => q.id !== questId))
    const { error } = await supabase.from('quests').update({ status: 'completed' }).eq('id', questId)
    if (error) console.error('completeQuest:', error)
    if (userId) {
      // Best-effort; the function is idempotent after the first activation.
      void activateReferral(userId)
    }
    return { xp: quest.xp_reward, quest }
  }, [quests, userId])

  const activeCount = quests.filter(q => q.status === 'active').length

  return {
    quests,
    loading,
    completeQuest,
    activeCount,
    hasQuests: quests.length > 0,
    refetch: fetchQuests,
  }
}

export function useCompletedQuests(userId: string | undefined) {
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQuests = useCallback(async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('quests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setQuests(data ?? [])
    } catch (e) {
      console.error('Failed to load completed quests:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    setLoading(true)
    void fetchQuests()
  }, [fetchQuests])

  return { quests, loading, refetch: fetchQuests }
}

// ─────────────────────────────────────────────────────────────
// PLAN & ACCESS
// ─────────────────────────────────────────────────────────────

export function usePlan(userId: string | undefined) {
  const [plan, setPlan] = useState<PlanStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    getPlanStatus(userId).then(p => { setPlan(p); setLoading(false) })
  }, [userId])

  const isTrialActive = plan?.plan === 'trial' && !plan?.isTrialExpired
  const isPro = plan?.plan === 'pro'
  const isFree = plan?.plan === 'free' || (plan?.plan === 'trial' && plan?.isTrialExpired)

  return {
    plan,
    loading,
    isTrialActive,
    isPro,
    isFree,
    daysLeft: plan?.daysLeft ?? 0,
    trialEndsAt: plan?.trialEndsAt ?? null,
    proEndsAt: plan?.proEndsAt ?? null,
    proDaysLeft: plan?.proDaysLeft ?? null,
  }
}

export function useFeatureAccess(userId: string | undefined, feature: FeatureKey) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!userId) return
    canUse(userId, feature).then(setAllowed)
  }, [userId, feature])

  return allowed
}

// ─────────────────────────────────────────────────────────────
// REFERRALS
// ─────────────────────────────────────────────────────────────

export function useReferral(userId: string | undefined) {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    getReferralStats(userId).then(s => { setStats(s); setLoading(false) })
  }, [userId])

  return { stats, loading }
}

// ─────────────────────────────────────────────────────────────
// DEGRADATION TIMER
// ─────────────────────────────────────────────────────────────

export function useDegradationWarning(lastActive: string | undefined, proGrace = false) {
  const [daysInactive, setDaysInactive] = useState(0)
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!lastActive) return
    const raw = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000)
    const days = Math.max(0, raw - (proGrace ? 1 : 0))
    setDaysInactive(days)
    if (days >= 7) setStage(4)
    else if (days >= 4) setStage(3)
    else if (days >= 2) setStage(2)
    else if (days >= 1) setStage(1)
    else setStage(0)
  }, [lastActive, proGrace])

  const messages: Record<number, string> = {
    0: '',
    1: 'Тень заметила твоё молчание.',
    2: 'Ты помнишь зачем начинал?',
    3: 'Тёмная фаза. Персонаж слабеет.',
    4: 'Критическое состояние. Пройди ритуал воскрешения.',
  }

  return { daysInactive, stage, warning: messages[stage], isDegrading: stage > 0 }
}

// ─────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────

export function useFloatingXP() {
  const [items, setItems] = useState<Array<{ id: number; amount: number; label: string; x: number }>>([])
  const counter = useRef(0)

  const show = useCallback((amount: number, label = 'XP', x = 50) => {
    const id = counter.current++
    setItems(prev => [...prev, { id, amount, label, x }])
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 1500)
  }, [])

  return { items, show }
}

export function useDebounce<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initial
    } catch { return initial }
  })

  const set = useCallback((v: T) => {
    setValue(v)
    try { localStorage.setItem(key, JSON.stringify(v)) } catch { }
  }, [key])

  return [value, set] as const
}

export function useTelegramTheme() {
  const tg = window.Telegram?.WebApp
  return {
    colorScheme: tg?.colorScheme ?? 'dark',
    isExpanded: tg?.isExpanded ?? false,
    expand: () => tg?.expand(),
    close: () => tg?.close(),
    haptic: {
      light: () => tg?.HapticFeedback?.impactOccurred('light'),
      medium: () => tg?.HapticFeedback?.impactOccurred('medium'),
      success: () => tg?.HapticFeedback?.notificationOccurred('success'),
      error: () => tg?.HapticFeedback?.notificationOccurred('error'),
    }
  }
}

export function useCountUp(target: number, duration = 1000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) return
    const steps = 30
    const increment = target / steps
    const interval = duration / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.round(current))
    }, interval)
    return () => clearInterval(timer)
  }, [target, duration])

  return count
}
