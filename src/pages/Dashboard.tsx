import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Target, Repeat, MessageCircle, Users, Flame } from 'lucide-react'
import CharacterAvatar from '@/components/CharacterAvatar'
import XPBar from '@/components/XPBar'
import TrialBadge from '@/components/TrialBadge'
import {
  useCharacter,
  usePlan,
  useQuests,
  useHabits,
  useDegradationWarning,
} from '@/hooks/useLifeQuest'
import type { User } from '@/types'

interface DashboardProps {
  user: User
}

const NAV_ITEMS = [
  { path: '/journal', icon: BookOpen, label: 'Дневник' },
  { path: '/habits', icon: Repeat, label: 'Привычки' },
  { path: '/quests', icon: Target, label: 'Квесты' },
  { path: '/chat', icon: MessageCircle, label: 'Наставник' },
  { path: '/referral', icon: Users, label: 'Реферал' },
]

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate()
  const { character, loading: charLoading } = useCharacter(user.id)
  const { isTrialActive, daysLeft } = usePlan(user.id)
  const { activeCount } = useQuests(user.id)
  const { weekProgress } = useHabits(user.id)
  const { warning, isDegrading } = useDegradationWarning(character?.last_active)

  if (charLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-24 px-4 pt-safe">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm">Добро пожаловать</p>
            <h1 className="text-xl font-bold text-white">
              {character?.name ?? user.tg_username ?? 'Герой'}
            </h1>
          </div>
          {isTrialActive && (
            <TrialBadge daysLeft={daysLeft} onClick={() => navigate('/referral')} />
          )}
        </div>

        {/* Character card */}
        {character && (
          <motion.div
            className="rounded-3xl p-5 mb-4"
            style={{ background: 'linear-gradient(135deg, #534AB722, #12121f)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-4 mb-4">
              <CharacterAvatar character={character} size="lg" />
              <div className="flex-1">
                <div className="text-xs text-gray-400 mb-1 capitalize">{character.class}</div>
                <h2 className="font-bold text-white text-lg">{character.name}</h2>
                <XPBar xp={character.xp} level={character.level} className="mt-2" />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              {(['mind', 'body', 'spirit', 'resource'] as const).map(stat => (
                <div
                  key={stat}
                  className="flex flex-col items-center bg-white/5 rounded-xl p-2"
                >
                  <span className="text-lg font-bold text-white">{character[stat]}</span>
                  <span className="text-xs text-gray-500 capitalize">
                    {stat === 'mind' ? 'Разум' : stat === 'body' ? 'Тело' : stat === 'spirit' ? 'Дух' : 'Ресурс'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Degradation warning */}
        {isDegrading && (
          <motion.div
            className="rounded-2xl p-4 mb-4 border border-red-500/30 bg-red-500/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-red-400 text-sm flex items-center gap-2">
              <Flame size={16} />
              {warning}
            </p>
          </motion.div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button
            onClick={() => navigate('/quests')}
            className="rounded-2xl p-4 text-left"
            style={{ background: '#534AB722', border: '1px solid #534AB744' }}
            whileTap={{ scale: 0.97 }}
          >
            <Target size={20} className="text-accent mb-2" />
            <div className="text-2xl font-bold text-white">{activeCount}</div>
            <div className="text-xs text-gray-400">активных квестов</div>
          </motion.button>
          <motion.button
            onClick={() => navigate('/habits')}
            className="rounded-2xl p-4 text-left"
            style={{ background: '#22c55e11', border: '1px solid #22c55e33' }}
            whileTap={{ scale: 0.97 }}
          >
            <Repeat size={20} className="text-green-400 mb-2" />
            <div className="text-2xl font-bold text-white">{weekProgress}%</div>
            <div className="text-xs text-gray-400">привычек сегодня</div>
          </motion.button>
        </div>

        {/* Nav grid */}
        <div className="grid grid-cols-3 gap-3">
          {NAV_ITEMS.map(({ path, icon: Icon, label }, i) => (
            <motion.button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center justify-center rounded-2xl p-4 gap-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Icon size={22} className="text-accent" />
              <span className="text-xs text-gray-300">{label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
