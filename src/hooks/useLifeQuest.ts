import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getPlanStatus, canUse } from '@/lib/access'
import { getReferralStats } from '@/lib/referral'
import type {
  User, Character, JournalEntry, Habit,
  Quest, FeatureKey, PlanStatus, ReferralStats
} from '@/types'

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

  return { character, loading, error, gainXP, revealCharacter }
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

export function useHabits(userId: string | undefined) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!userId) return
    async function fetch() {
      try {
        const [habitsRes, logsRes] = await Promise.all([
          supabase.from('habits').select('*').eq('user_id', userId).order('created_at'),
          supabase.from('habit_logs').select('habit_id, completed').eq('date', today)
        ])
        if (habitsRes.error) throw habitsRes.error
        setHabits(habitsRes.data ?? [])
        const logs: Record<string, boolean> = {}
        logsRes.data?.forEach(l => { logs[l.habit_id] = l.completed })
        setTodayLogs(logs)
      } catch (e) {
        console.error('Failed to load habits:', e)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [userId, today])

  const toggleHabit = useCallback(async (habitId: string): Promise<boolean> => {
    const isDone = todayLogs[habitId]
    setTodayLogs(prev => ({ ...prev, [habitId]: !isDone }))

    if (isDone) {
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', today)
    } else {
      await supabase.from('habit_logs').upsert({ habit_id: habitId, date: today, completed: true })
      const habit = habits.find(h => h.id === habitId)
      if (habit) {
        const newStreak = habit.streak + 1
        await supabase.from('habits').update({ streak: newStreak, last_done: today }).eq('id', habitId)
        setHabits(prev => prev.map(h => h.id === habitId ? { ...h, streak: newStreak } : h))
      }
    }
    return !isDone
  }, [habits, todayLogs, today])

  const addHabit = useCallback(async (name: string, sphere: string, frequency = 'daily') => {
    if (!userId) return
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: userId, name, sphere, frequency })
      .select()
      .single()
    if (error) throw error
    setHabits(prev => [...prev, data])
    return data
  }, [userId])

  const weekProgress = Math.round((Object.values(todayLogs).filter(Boolean).length / Math.max(habits.length, 1)) * 100)

  return { habits, todayLogs, loading, toggleHabit, addHabit, weekProgress }
}

// ─────────────────────────────────────────────────────────────
// QUESTS
// ─────────────────────────────────────────────────────────────

export function useQuests(userId: string | undefined) {
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    async function fetch() {
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
    }
    fetch()
  }, [userId])

  const completeQuest = useCallback(async (questId: string): Promise<number> => {
    const quest = quests.find(q => q.id === questId)
    if (!quest) return 0
    setQuests(prev => prev.filter(q => q.id !== questId))
    await supabase.from('quests').update({ status: 'completed' }).eq('id', questId)
    return quest.xp_reward
  }, [quests])

  const activeCount = quests.filter(q => q.status === 'active').length

  return { quests, loading, completeQuest, activeCount, hasQuests: quests.length > 0 }
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
