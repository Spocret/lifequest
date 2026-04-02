/** Названия рангов по ТЗ п. 2.4 (уровни 1–8). */
export const LEVEL_RANK_NAMES: readonly string[] = [
  'Спящий',
  'Ученик',
  'Искатель',
  'Путник',
  'Воин духа',
  'Хранитель',
  'Архонт',
  'Легенда',
]

export function levelRankName(level: number): string {
  const i = Math.min(Math.max(level, 1), LEVEL_RANK_NAMES.length) - 1
  return LEVEL_RANK_NAMES[i] ?? 'Путник'
}
