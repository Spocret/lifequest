import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getPlanStatus, canUse } from '@/lib/access'
import { getReferralStats } from '@/lib/referral'
import type {
  User, Character, JournalEntry, Habit,
  Quest, FeatureKey, PlanStatus, ReferralStats
} from '@/types'

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

export function useHabits(userId: string | undefined) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<Record<string, boolean>>({})
  const [weekMarks, setWeekMarks] = useState<WeekDayMark[]>(initialWeekMarks)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

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

  useEffect(() => {
    if (!userId) return
    async function fetch() {
      try {
        const [habitsRes, logsRes] = await Promise.all([
          supabase.from('habits').select('*').eq('user_id', userId).order('created_at'),
          supabase.from('habit_logs').select('habit_id, completed').eq('date', today),
        ])
        if (habitsRes.error) throw habitsRes.error
        const list = habitsRes.data ?? []
        setHabits(list)
        const logs: Record<string, boolean> = {}
        logsRes.data?.forEach(l => {
          logs[l.habit_id] = l.completed
        })
        setTodayLogs(logs)
        await fetchWeekMarks(list)
      } catch (e) {
        console.error('Failed to load habits:', e)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [userId, today, fetchWeekMarks])

  const toggleHabit = useCallback(
    async (habitId: string): Promise<HabitToggleResult> => {
      const habit = habits.find(h => h.id === habitId) ?? null
      if (!habit) return { completed: false, habit: null, streakBonus: false }

      const isDone = todayLogs[habitId]
      const prevLogs = { ...todayLogs }
      const prevHabits = habits.map(h => ({ ...h }))

      setTodayLogs(prev => ({ ...prev, [habitId]: !isDone }))

      try {
        if (isDone) {
          await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', today)

          const { data: prevRow } = await supabase
            .from('habit_logs')
            .select('date')
            .eq('habit_id', habitId)
            .eq('completed', true)
            .neq('date', today)
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
          await fetchWeekMarks(habits.map(h => (h.id === habitId ? updated : h)))
          return { completed: false, habit: updated, streakBonus: false }
        }

        await supabase.from('habit_logs').upsert({ habit_id: habitId, date: today, completed: true })

        const y = new Date(today + 'T12:00:00')
        y.setDate(y.getDate() - 1)
        const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`

        let newStreak: number
        if (habit.last_done === null) {
          newStreak = 1
        } else if (habit.last_done === yStr) {
          newStreak = habit.streak + 1
        } else if (habit.last_done === today) {
          newStreak = habit.streak
        } else {
          newStreak = 1
        }

        await supabase
          .from('habits')
          .update({ streak: newStreak, last_done: today })
          .eq('id', habitId)

        const updated: Habit = { ...habit, streak: newStreak, last_done: today }
        setHabits(prev => prev.map(h => (h.id === habitId ? updated : h)))

        const streakBonus = newStreak > 0 && newStreak % 7 === 0
        await fetchWeekMarks(habits.map(h => (h.id === habitId ? updated : h)))
        return { completed: true, habit: updated, streakBonus }
      } catch (e) {
        console.error(e)
        setTodayLogs(prevLogs)
        setHabits(prevHabits)
        return { completed: false, habit, streakBonus: false }
      }
    },
    [habits, todayLogs, today, fetchWeekMarks],
  )

  const addHabit = useCallback(
    async (name: string, sphere: string, frequency: 'daily' | 'weekly' = 'daily') => {
      if (!userId) return
      const { data, error } = await supabase
        .from('habits')
        .insert({ user_id: userId, name, sphere, frequency })
        .select()
        .single()
      if (error) throw error
      setHabits(prev => {
        const next = [...prev, data]
        void fetchWeekMarks(next)
        return next
      })
      return data
    },
    [userId, fetchWeekMarks],
  )

  return { habits, todayLogs, weekMarks, loading, toggleHabit, addHabit }
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
    return { xp: quest.xp_reward, quest }
  }, [quests])

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
