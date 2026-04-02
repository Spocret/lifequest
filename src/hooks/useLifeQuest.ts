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
import { localYmd } from '@/lib/date'
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

  useEffect(() => {
    if (!userId) return
    async function fetch() {
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
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [userId])

  const gainXP = useCallback(async (amount: number, stat?: keyof Pick<Character, 'mind' | 'body' | 'spirit' | 'resource'>, statAmount = 2) => {
    if (!character) return
    const updates: Partial<Character> = {
      xp: character.xp + amount,
      last_active: new Date().toISOString(),
    }
    if (stat) updates[stat] = (character[stat] as number) + statAmount

    const newXP = updates.xp as number
    const currentLevel = character.level
    const newLevel = calculateLevel(newXP)
    if (newLevel > currentLevel) updates.level = newLevel

    const { data, error } = await supabase
      .from('characters')
      .update(updates)
      .eq('id', character.id)
      .select()
      .single()

    if (!error && data) {
      setCharacter(data)
      return { levelUp: newLevel > currentLevel, newLevel }
    }
  }, [character])

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

    if (!error && data) setCharacter(data)
  }, [character])

  return { character, loading, error, gainXP, revealCharacter, completeFirstJournalReveal }
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
    if (!userId) return
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
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
    if (error) throw error
    setEntries(prev => [data, ...prev])
    return data
  }, [userId])

  const monthlyCount = entries.filter(e => {
    const entryDate = new Date(e.created_at)
    const now = new Date()
    return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear()
  }).length

  return { entries, loading, error, addEntry, monthlyCount, isFirstEntry: entries.length === 0 }
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
}

export type WeekDayMark = { short: string; date: string; filled: boolean }

function initialWeekMarks(): WeekDayMark[] {
  const dates = getWeekMonSunDates()
  return dates.map((date, i) => ({ short: WEEK_SHORT_RU[i], date, filled: false }))
}

const DEFAULT_WEEKDAYS: number[] = [1, 2, 3, 4, 5, 6, 7]

/** Minimal columns for old DBs (no weekdays / cache issues). No created_at — not all projects have it. */
const HABIT_COLUMNS_MINIMAL =
  'id, user_id, name, sphere, frequency, streak, last_done'

const HABIT_COLUMNS_LEGACY = `${HABIT_COLUMNS_MINIMAL}, weekdays`

function normalizeHabitRow(row: Habit): Habit {
  const w = row.weekdays
  const weekdays =
    Array.isArray(w) && w.length > 0 ? w.map(n => Number(n)) : DEFAULT_WEEKDAYS
  return {
    ...row,
    weekdays,
    created_at: row.created_at ?? '',
  }
}

function useHabitsInternal(userId: string | undefined) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<Record<string, boolean>>({})
  const [completionCounts, setCompletionCounts] = useState<Record<string, number>>({})
  const [weekMarks, setWeekMarks] = useState<WeekDayMark[]>(initialWeekMarks)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSeq = useRef(0)

  const fetchWeekMarks = useCallback(
    async (habitList: Habit[]) => {
      const dates = getWeekMonSunDates()
      if (habitList.length === 0) {
        setWeekMarks(dates.map((date, i) => ({ short: WEEK_SHORT_RU[i], date, filled: false })))
        return
      }
      const ids = habitList.map(h => h.id)
      const { data, error } = await supabase
        .from('habit_logs')
        .select('date')
        .in('habit_id', ids)
        .eq('completed', true)
        .gte('date', dates[0])
        .lte('date', dates[6])
      if (error) {
        console.error('week marks:', error)
        setWeekMarks(dates.map((date, i) => ({ short: WEEK_SHORT_RU[i], date, filled: false })))
        return
      }
      const filledDates = new Set((data ?? []).map(r => r.date))
      setWeekMarks(
        dates.map((date, i) => ({
          short: WEEK_SHORT_RU[i],
          date,
          filled: filledDates.has(date),
        })),
      )
    },
    [],
  )

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

  const fetchHabits = useCallback(async () => {
    if (!userId) return
    const seq = ++fetchSeq.current
    const todayStr = localYmd()
    setLoading(true)
    setError(null)
    try {
      let habitsRes = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('id')
      if (seq !== fetchSeq.current) return
      if (habitsRes.error) {
        const hint = supabaseErrorMessage(habitsRes.error, '')
        const looksLikeWeekdays = /weekdays/i.test(hint) || /schema cache/i.test(hint)
        if (looksLikeWeekdays) {
          habitsRes = await supabase
            .from('habits')
            .select(HABIT_COLUMNS_LEGACY)
            .eq('user_id', userId)
            .order('id')
          if (seq !== fetchSeq.current) return
          if (habitsRes.error) {
            const h2 = supabaseErrorMessage(habitsRes.error, '')
            if (/weekdays/i.test(h2) || /schema cache/i.test(h2)) {
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
      const list = (habitsRes.data ?? []).map(normalizeHabitRow)
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
  }, [userId, fetchWeekMarks])

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
    async (habitId: string): Promise<HabitToggleResult> => {
      const habit = habits.find(h => h.id === habitId) ?? null
      if (!habit) return { completed: false, habit: null, streakBonus: false }

      const todayStr = localYmd()
      const isDone = todayLogs[habitId]
      const prevLogs = { ...todayLogs }
      const prevHabits = habits.map(h => ({ ...h }))

      setTodayLogs(prev => ({ ...prev, [habitId]: !isDone }))

      try {
        if (isDone) {
          await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', todayStr)

          const { data: prevRow } = await supabase
            .from('habit_logs')
            .select('date')
            .eq('habit_id', habitId)
            .eq('completed', true)
            .neq('date', todayStr)
            .order('date', { ascending: false })
            .limit(1)

          const newLastDone = prevRow?.[0]?.date ?? null
          const newStreak = Math.max(0, habit.streak - 1)

          await supabase
            .from('habits')
            .update({ streak: newStreak, last_done: newLastDone })
            .eq('id', habitId)

          const updated: Habit = { ...habit, streak: newStreak, last_done: newLastDone }
          setHabits(prev => prev.map(h => (h.id === habitId ? updated : h)))
          setCompletionCounts(prev => ({
            ...prev,
            [habitId]: Math.max(0, (prev[habitId] ?? 0) - 1),
          }))
          await fetchWeekMarks(habits.map(h => (h.id === habitId ? updated : h)))
          return { completed: false, habit: updated, streakBonus: false }
        }

        await supabase.from('habit_logs').upsert({ habit_id: habitId, date: todayStr, completed: true })

        const y = new Date(todayStr + 'T12:00:00')
        y.setDate(y.getDate() - 1)
        const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`

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

        const updated: Habit = { ...habit, streak: newStreak, last_done: todayStr }
        setHabits(prev => prev.map(h => (h.id === habitId ? updated : h)))

        const streakBonus = newStreak > 0 && newStreak % 7 === 0
        setCompletionCounts(prev => ({
          ...prev,
          [habitId]: (prev[habitId] ?? 0) + 1,
        }))
        await fetchWeekMarks(habits.map(h => (h.id === habitId ? updated : h)))
        return { completed: true, habit: updated, streakBonus }
      } catch (e) {
        console.error(e)
        setTodayLogs(prevLogs)
        setHabits(prevHabits)
        return { completed: false, habit, streakBonus: false }
      }
    },
    [habits, todayLogs, fetchWeekMarks],
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
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
    loadLogsForDate,
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

  return { plan, loading, isTrialActive, isPro, isFree, daysLeft: plan?.daysLeft ?? 0 }
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

export function useDegradationWarning(lastActive: string | undefined) {
  const [daysInactive, setDaysInactive] = useState(0)
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!lastActive) return
    const days = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000)
    setDaysInactive(days)
    if (days >= 7) setStage(4)
    else if (days >= 4) setStage(3)
    else if (days >= 2) setStage(2)
    else if (days >= 1) setStage(1)
    else setStage(0)
  }, [lastActive])

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
