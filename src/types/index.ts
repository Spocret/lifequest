export interface User {
  id: string
  tg_id: number
  tg_username: string | null
  plan: 'free' | 'trial' | 'pro'
  trial_end: string | null
  referral_code: string
  referred_by: string | null
  created_at: string
}

export interface Character {
  id: string
  user_id: string
  name: string
  class: 'warrior' | 'mage' | 'rogue' | 'healer'
  avatar_url: string | null
  avatar_state: 'hidden' | 'silhouette' | 'revealed'
  level: number
  xp: number
  mind: number
  body: number
  spirit: number
  resource: number
  last_active: string
  created_at: string
}

export interface JournalEntry {
  id: string
  user_id: string
  content: string
  ai_response: string | null
  sphere: string | null
  xp_gained: number
  created_at: string
}

export interface Habit {
  id: string
  user_id: string
  name: string
  sphere: string
  frequency: 'daily' | 'weekly'
  streak: number
  last_done: string | null
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  date: string
  completed: boolean
}

export interface Quest {
  id: string
  user_id: string
  title: string
  description: string
  sphere: string
  difficulty: 'easy' | 'medium' | 'hard' | 'epic'
  xp_reward: number
  status: 'active' | 'completed' | 'failed'
  deadline: string | null
  created_at: string
}

export interface WeeklyInsight {
  id: string
  user_id: string
  week_start: string
  summary: string
  top_sphere: string | null
  xp_earned: number
  created_at: string
}

export interface Referral {
  id: string
  referrer_id: string
  referred_id: string
  bonus_granted: boolean
  created_at: string
}

export interface ReferralStats {
  code: string
  count: number
  bonusDays: number
}

export type FeatureKey =
  | 'journal'
  | 'ai_journal'
  | 'habits'
  | 'quests'
  | 'ai_quests'
  | 'chat'
  | 'weekly_insight'
  | 'referral'

export interface PlanStatus {
  plan: 'free' | 'trial' | 'pro'
  isTrialExpired: boolean
  daysLeft: number
  features: Record<FeatureKey, boolean>
}

export type Sphere = 'mind' | 'body' | 'spirit' | 'resource'

export const SPHERE_LABELS: Record<Sphere, string> = {
  mind: 'Разум',
  body: 'Тело',
  spirit: 'Дух',
  resource: 'Ресурс',
}

export const SPHERE_COLORS: Record<Sphere, string> = {
  mind: '#7F77DD',
  body: '#4CAF50',
  spirit: '#FF9800',
  resource: '#2196F3',
}

export const DIFFICULTY_XP: Record<Quest['difficulty'], number> = {
  easy: 50,
  medium: 150,
  hard: 400,
  epic: 1000,
}
