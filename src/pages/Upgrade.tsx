import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Brain, MessageCircle, Target, BarChart2, Users } from 'lucide-react'
import type { User } from '@/types'

interface UpgradeProps {
  user: User
}

const FEATURES = [
  {
    icon: Brain,
    label: 'ИИ-анализ дневника',
    desc: 'Персональные инсайты после каждой записи',
  },
  {
    icon: Target,
    label: 'ИИ-квесты',
    desc: 'Квесты, созданные специально для тебя',
  },
  {
    icon: MessageCircle,
    label: 'Наставник ИИ',
    desc: 'Чат с личным ментором 24/7',
  },
  {
    icon: BarChart2,
    label: 'Еженедельные отчёты',
    desc: 'Анализ прогресса и топ-сфера недели',
  },
]

export default function Upgrade({ user }: UpgradeProps) {
  const navigate = useNavigate()
  const isPro = user.plan === 'pro'

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pb-4">
        <motion.button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft size={20} className="text-white" />
        </motion.button>
        <h1 className="text-lg font-bold text-white">Улучшить план</h1>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5">
        {/* Hero card */}
        <motion.div
          className="rounded-3xl p-6 text-center"
          style={{ background: 'linear-gradient(135deg, #534AB733, #0a0a14)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-4xl mb-3">⚡</div>
          <h2 className="text-2xl font-bold text-white mb-2">LifeQuest Pro</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Разблокируй весь потенциал своего героя с помощью ИИ
          </p>
          {isPro && (
            <div
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: '#534AB733', color: '#a09af5' }}
            >
              ✓ Активен
            </div>
          )}
        </motion.div>

        {/* Feature list */}
        <div className="flex flex-col gap-3">
          {FEATURES.map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              className="flex items-center gap-4 rounded-2xl p-4"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.07 }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#534AB722' }}
              >
                <Icon size={20} style={{ color: '#534AB7' }} />
              </div>
              <div>
                <div className="text-white text-sm font-semibold">{label}</div>
                <div className="text-gray-500 text-xs mt-0.5">{desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        {!isPro && (
          <motion.button
            onClick={() => navigate('/referral')}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #534AB7, #7B72E0)' }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <Users size={18} />
            Пригласи друзей → Получи Pro
          </motion.button>
        )}
      </div>
    </div>
  )
}
