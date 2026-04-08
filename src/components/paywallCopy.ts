import type { FeatureKey } from '@/lib/access'

export const FEATURE_TITLES: Record<FeatureKey, string> = {
  journal_entry: 'Записи в дневнике',
  journal_ai: 'ИИ-вопрос после записи',
  habit_add: 'Новые привычки',
  ai_chat: 'ИИ-наставник',
  weekly_insight: 'Еженедельный инсайт',
  history: 'Полная история',
}

export const PAYWALL_MESSAGE =
  'Ты уже в пути. Pro открывает следующий шаг — без ограничений и с поддержкой.'

export const PAYWALL_CTA = 'Открыть Pro 490 ₽/мес'

