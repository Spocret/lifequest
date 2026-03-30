import { supabase } from '@/lib/supabase'
import type { ArchitectGeneratedQuest } from '@/lib/ai'
import type { Character, Quest } from '@/types'
import { DIFFICULTY_XP } from '@/types'
import type { Sphere } from '@/types'

export type QuestRank = 'F' | 'E' | 'D' | 'C'

/** Sphere with lowest stat value (ties → mind, body, spirit, resource). */
export function weakestSphere(character: Character): Sphere {
  const pairs: [Sphere, number][] = [
    ['mind', character.mind],
    ['body', character.body],
    ['spirit', character.spirit],
    ['resource', character.resource],
  ]
  let min = pairs[0][1]
  let sphere: Sphere = pairs[0][0]
  for (const [s, v] of pairs) {
    if (v < min) {
      min = v
      sphere = s
    }
  }
  return sphere
}

export function sphereToStatKey(sphere: Sphere): keyof Pick<Character, 'mind' | 'body' | 'spirit' | 'resource'> {
  return sphere
}

export function rankFromDifficulty(d: Quest['difficulty']): QuestRank {
  if (d === 'easy') return 'F'
  if (d === 'medium') return 'E'
  if (d === 'hard') return 'D'
  return 'C'
}

export function rankToDifficulty(rank: string): Quest['difficulty'] {
  const u = rank.trim().toUpperCase()
  if (u === 'F') return 'easy'
  if (u === 'E') return 'medium'
  if (u === 'D') return 'hard'
  return 'medium'
}

export function normalizeSphere(s: string): Sphere | null {
  const x = s.trim().toLowerCase()
  if (x === 'mind' || x === 'body' || x === 'spirit' || x === 'resource') return x
  return null
}

export interface InsertGeneratedQuestRow {
  title: string
  description: string
  sphere: Sphere
  rank: 'F' | 'E' | 'D'
  xp_reward: number
  deadline: string | null
}

export async function insertGeneratedQuests(userId: string, rows: InsertGeneratedQuestRow[]): Promise<boolean> {
  if (rows.length === 0) return true
  const payload = rows.map(r => ({
    user_id: userId,
    title: r.title,
    description: r.description,
    sphere: r.sphere,
    difficulty: rankToDifficulty(r.rank),
    xp_reward: r.xp_reward,
    status: 'active' as const,
    deadline: r.deadline,
  }))
  const { error } = await supabase.from('quests').insert(payload)
  if (error) {
    console.error('insertGeneratedQuests:', error)
    return false
  }
  return true
}

/** Normalize Архитектор JSON → DB rows (max 3). */
export function mapArchitectQuestsToRows(rows: ArchitectGeneratedQuest[]): InsertGeneratedQuestRow[] {
  const out: InsertGeneratedQuestRow[] = []
  for (const r of rows.slice(0, 3)) {
    const sphere = normalizeSphere(r.sphere)
    if (!sphere) continue
    const rankRaw = String(r.rank).trim().toUpperCase()
    if (rankRaw !== 'F' && rankRaw !== 'E' && rankRaw !== 'D') continue
    const rank = rankRaw as 'F' | 'E' | 'D'
    let hours = Number(r.deadline_hours)
    if (!Number.isFinite(hours)) hours = 72
    hours = Math.min(168, Math.max(24, Math.round(hours)))
    const deadline = new Date(Date.now() + hours * 3600000).toISOString()
    let xp = Math.round(Number(r.xp_reward))
    if (!Number.isFinite(xp) || xp < 1) {
      xp = DIFFICULTY_XP[rankToDifficulty(rank)]
    }
    out.push({
      title: String(r.title).trim().slice(0, 200),
      description: String(r.description).trim().slice(0, 800),
      sphere,
      rank,
      xp_reward: xp,
      deadline,
    })
  }
  return out
}
