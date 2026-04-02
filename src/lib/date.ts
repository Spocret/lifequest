import type { Habit } from '@/types'

/** Local calendar YYYY-MM-DD (not UTC). */
export function localYmd(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekdayFromYmd(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const wd = dt.getDay()
  return wd === 0 ? 7 : wd
}

/** Whether the habit is planned on that calendar day (by weekday). */
export function isHabitScheduledForDate(habit: Habit, dateStr: string): boolean {
  const w = isoWeekdayFromYmd(dateStr)
  const days = habit.weekdays
  if (days && days.length > 0) return days.includes(w)
  return true
}
