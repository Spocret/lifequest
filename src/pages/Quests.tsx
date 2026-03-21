import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Wand2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuests, useCharacter, usePlan, useFloatingXP } from '@/hooks/useLifeQuest'
import { generateQuests } from '@/lib/ai'
import { supabase } from '@/lib/supabase'
import QuestCard from '@/components/QuestCard'
import Paywall from '@/components/Paywall'
import type { User, Quest } from '@/types'
import { DIFFICULTY_XP } from '@/types'

interface QuestsProps {
  user: User
}

export default function Quests({ user }: QuestsProps) {
  const navigate = useNavigate()
  const { quests, completeQuest } = useQuests(user.id)
  const { character, gainXP } = useCharacter(user.id)
  const { isPro, isTrialActive } = usePlan(user.id)
  const { items: xpItems, show: showXP } = useFloatingXP()

  const [generating, setGenerating] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)

  const canGenerate = isPro || isTrialActive

  async function handleComplete(id: string) {
    const xp = await completeQuest(id)
    await gainXP?.(xp, 'spirit', 2)
    showXP(xp, `+${xp} XP`, 50)
  }

  async function handleGenerate() {
    if (!canGenerate) {
      setPaywallOpen(true)
      return
    }
    if (!character) return
    setGenerating(true)
    try {
      const context = `Герой: ${character.name}, класс: ${character.class}, уровень: ${character.level}. Характеристики: разум ${character.mind}, тело ${character.body}, дух ${character.spirit}, ресурс ${character.resource}.`
      const generated = await generateQuests(context)
      await Promise.all(
        generated.map(q =>
          supabase.from('quests').insert({
            user_id: user.id,
            title: q.title,
            description: q.description,
            sphere: q.sphere,
            difficulty: q.difficulty as Quest['difficulty'],
            xp_reward: DIFFICULTY_XP[q.difficulty as Quest['difficulty']] ?? 100,
            status: 'active',
          }),
        ),
      )
      window.location.reload()
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white flex-1">Квесты</h1>
        <motion.button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-60"
          style={{ background: canGenerate ? 'linear-gradient(135deg, #534AB7, #7F77DD)' : '#534AB733', border: canGenerate ? 'none' : '1px solid #534AB766' }}
          whileTap={{ scale: 0.95 }}
        >
          <Wand2 size={16} />
          {generating ? 'Генерация...' : 'AI-квесты'}
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-8 space-y-3">
        {quests.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <Wand2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Нет активных квестов</p>
            <p className="text-sm mt-1">Сгенерируй персонализированные с помощью AI</p>
          </div>
        )}
        {quests.map((quest, i) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <QuestCard quest={quest} onComplete={handleComplete} />
          </motion.div>
        ))}
      </div>

      {xpItems.map(item => (
        <motion.div
          key={item.id}
          className="fixed text-accent font-bold text-lg pointer-events-none z-50"
          style={{ left: `${item.x}%`, bottom: '40%' }}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -60 }}
          transition={{ duration: 1.2 }}
        >
          +{item.amount} {item.label}
        </motion.div>
      ))}

      <Paywall
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        featureName="AI-квесты"
        isTrialAvailable={false}
        onUpgrade={() => setPaywallOpen(false)}
      />
    </div>
  )
}
