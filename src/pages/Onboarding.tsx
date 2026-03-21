import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Character } from '@/types'

interface OnboardingProps {
  userId: string
}

const CLASSES: Array<{ id: Character['class']; label: string; icon: string; desc: string }> = [
  { id: 'warrior', label: 'Воин', icon: '⚔️', desc: 'Действие, сила, дисциплина' },
  { id: 'mage', label: 'Маг', icon: '🔮', desc: 'Интеллект, знания, стратегия' },
  { id: 'rogue', label: 'Плут', icon: '🗡️', desc: 'Гибкость, скорость, адаптация' },
  { id: 'healer', label: 'Целитель', icon: '✨', desc: 'Баланс, здоровье, гармония' },
]

const STEPS = ['welcome', 'name', 'class', 'trial'] as const
type Step = (typeof STEPS)[number]

export default function Onboarding({ userId }: OnboardingProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [selectedClass, setSelectedClass] = useState<Character['class'] | null>(null)
  const [loading, setLoading] = useState(false)

  async function createCharacter() {
    if (!name.trim() || !selectedClass) return
    setLoading(true)
    try {
      // auth.ts already created the placeholder row with avatar_state='hidden'.
      // We update it with the real name, class, and mark onboarding complete.
      const { error } = await supabase
        .from('characters')
        .update({
          name: name.trim(),
          class: selectedClass,
          avatar_state: 'silhouette',
          last_active: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) throw error
      navigate('/dashboard')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background px-6 py-8">
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            className="flex-1 flex flex-col items-center justify-center text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <motion.div
              className="text-7xl mb-6"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ⚔️
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-4">LifeQuest</h1>
            <p className="text-gray-400 text-lg mb-2">Твоя жизнь — это RPG.</p>
            <p className="text-gray-500 text-sm mb-10 max-w-xs">
              Веди дневник, выполняй квесты и развивай своего персонажа в реальной жизни.
            </p>
            <motion.button
              onClick={() => setStep('name')}
              className="w-full max-w-xs py-4 rounded-2xl font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
              whileTap={{ scale: 0.97 }}
            >
              Начать приключение
            </motion.button>
          </motion.div>
        )}

        {step === 'name' && (
          <motion.div
            key="name"
            className="flex-1 flex flex-col pt-8"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
          >
            <h2 className="text-2xl font-bold text-white mb-2">Имя героя</h2>
            <p className="text-gray-400 mb-8">Как тебя будут называть в LifeQuest?</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Введи имя..."
              maxLength={30}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-accent/60 text-lg"
              autoFocus
            />
            <div className="mt-auto pt-8">
              <motion.button
                onClick={() => name.trim().length >= 2 && setStep('class')}
                disabled={name.trim().length < 2}
                className="w-full py-4 rounded-2xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                whileTap={{ scale: 0.97 }}
              >
                Продолжить
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 'class' && (
          <motion.div
            key="class"
            className="flex-1 flex flex-col pt-8"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
          >
            <h2 className="text-2xl font-bold text-white mb-2">Выбери класс</h2>
            <p className="text-gray-400 mb-6">Это определит твой стиль развития</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {CLASSES.map(c => (
                <motion.button
                  key={c.id}
                  onClick={() => setSelectedClass(c.id)}
                  className="p-4 rounded-2xl border text-left transition-colors"
                  style={{
                    borderColor: selectedClass === c.id ? '#7F77DD' : 'rgba(255,255,255,0.1)',
                    background: selectedClass === c.id ? '#534AB722' : 'rgba(255,255,255,0.03)',
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="text-3xl mb-2">{c.icon}</div>
                  <div className="font-semibold text-white text-sm">{c.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{c.desc}</div>
                </motion.button>
              ))}
            </div>
            <motion.button
              onClick={() => selectedClass && setStep('trial')}
              disabled={!selectedClass}
              className="w-full py-4 rounded-2xl font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
              whileTap={{ scale: 0.97 }}
            >
              Выбрать
            </motion.button>
          </motion.div>
        )}

        {step === 'trial' && (
          <motion.div
            key="trial"
            className="flex-1 flex flex-col items-center justify-center text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-6xl mb-6">🎁</div>
            <h2 className="text-2xl font-bold text-white mb-3">5 дней бесплатно</h2>
            <p className="text-gray-400 mb-2 max-w-xs">
              Получи полный доступ ко всем возможностям LifeQuest Pro:
            </p>
            <ul className="text-left text-sm text-gray-400 space-y-2 mb-10 mt-4">
              <li>✦ AI-анализ твоих записей</li>
              <li>✦ Персонализированные квесты</li>
              <li>✦ Чат с ИИ-наставником</li>
              <li>✦ Еженедельная аналитика</li>
            </ul>
            <motion.button
              onClick={createCharacter}
              disabled={loading}
              className="w-full max-w-xs py-4 rounded-2xl font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? 'Создаём героя...' : 'Начать путь'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
