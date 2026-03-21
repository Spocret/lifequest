import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Star, Shield, MessageCircle } from 'lucide-react'

interface PaywallProps {
  isOpen: boolean
  onClose: () => void
  featureName?: string
  onStartTrial?: () => void
  onUpgrade?: () => void
  isTrialAvailable?: boolean
}

const PRO_FEATURES = [
  { icon: Zap, text: 'AI-анализ дневниковых записей' },
  { icon: Star, text: 'Персонализированные квесты от ИИ' },
  { icon: MessageCircle, text: 'Чат с ИИ-наставником' },
  { icon: Shield, text: 'Еженедельные инсайты и аналитика' },
]

export default function Paywall({
  isOpen,
  onClose,
  featureName,
  onStartTrial,
  onUpgrade,
  isTrialAvailable = false,
}: PaywallProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6"
            style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="text-4xl mb-3">⚔️</div>
              <h2 className="text-xl font-bold text-white mb-2">
                {featureName ? `${featureName} — Pro` : 'Разблокируй LifeQuest Pro'}
              </h2>
              <p className="text-gray-400 text-sm">
                Получи доступ ко всем возможностям ИИ-наставника
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {PRO_FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-accent" />
                  </div>
                  <span className="text-sm text-gray-300">{text}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {isTrialAvailable && onStartTrial && (
                <motion.button
                  onClick={onStartTrial}
                  className="w-full py-4 rounded-2xl font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  Начать 5-дневный пробный период
                </motion.button>
              )}
              {onUpgrade && (
                <motion.button
                  onClick={onUpgrade}
                  className="w-full py-4 rounded-2xl font-semibold border border-accent/40 text-accent"
                  whileTap={{ scale: 0.97 }}
                >
                  Подключить Pro — 490 ₽/мес
                </motion.button>
              )}
              <button onClick={onClose} className="w-full py-3 text-sm text-gray-500">
                Остаться на бесплатном
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
