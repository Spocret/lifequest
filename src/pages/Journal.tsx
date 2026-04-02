import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Sparkles, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useJournal, useCharacter, useFeatureAccess, useFloatingXP } from '@/hooks/useLifeQuest'
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset'
import { analyzeJournalEntry } from '@/lib/ai'
import { canUse } from '@/lib/access'
import Paywall from '@/components/Paywall'
import type { User } from '@/types'

interface JournalProps {
  user: User
}

export default function Journal({ user }: JournalProps) {
  const navigate = useNavigate()
  const { entries, addEntry, monthlyCount } = useJournal(user.id)
  const { gainXP } = useCharacter(user.id)
  const canUseAI = useFeatureAccess(user.id, 'journal_ai') === true
  const { items: xpItems, show: showXP } = useFloatingXP()
  const { bottomInset } = useVisualViewportInset()

  const [text, setText] = useState('')
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitBlocked, setSubmitBlocked] = useState(false)

  async function handleSubmit() {
    if (!text.trim() || loading) return
    setSubmitBlocked(false)

    const allowed = await canUse(user.id, 'journal_entry')
    if (!allowed) {
      setSubmitBlocked(true)
      return
    }

    setLoading(true)
    try {
      let aiText: string | undefined
      if (canUseAI) {
        try {
          aiText = await analyzeJournalEntry(text)
          setAiResponse(aiText)
        } catch (e) {
          console.error(e)
          // Запись должна сохраниться даже если ИИ недоступен (ключ, сеть, лимиты).
        }
      }
      await addEntry(text, aiText)
      await gainXP?.(50, 'spirit', 3)
      showXP(50, '+50 XP', 50)
      setText('')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Paywall feature="journal_entry" userId={user.id}>
      <div className="min-h-dvh bg-background flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-safe pb-4">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Дневник</h1>
          <span className="text-xs text-gray-500">{monthlyCount} записей в этом месяце</span>
        </div>

        {/* Entries — scroll; padding leaves room for fixed composer + nav */}
        <div
          className="flex-1 overflow-y-auto scrollbar-hide px-4 min-h-0 space-y-3"
          style={{
            paddingBottom: `calc(14rem + env(safe-area-inset-bottom, 0px) + ${bottomInset}px)`,
          }}
        >
          {entries.map(entry => (
            <motion.div
              key={entry.id}
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-sm text-gray-300 mb-2 whitespace-pre-wrap">{entry.content}</p>
              {entry.ai_response && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-xs text-accent mb-1 flex items-center gap-1">
                    <Sparkles size={10} /> Наставник
                  </p>
                  <p className="text-xs text-gray-400">{entry.ai_response}</p>
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-600">
                  {new Date(entry.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
                </span>
                <span className="text-xs text-accent">+{entry.xp_gained} XP</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Composer: fixed above bottom nav + keyboard inset (iOS / Telegram) */}
        <div
          className="fixed left-0 right-0 z-40 px-4 pt-2 border-t border-white/5 bg-background/95 backdrop-blur-md"
          style={{
            bottom: `calc(4rem + env(safe-area-inset-bottom, 0px) + ${bottomInset}px)`,
          }}
        >
          <AnimatePresence>
            {aiResponse && (
              <motion.div
                className="mb-3 p-4 rounded-2xl"
                style={{ background: '#534AB722', border: '1px solid #534AB744' }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-accent" />
                  <span className="text-xs font-medium text-accent">Наставник</span>
                </div>
                <p className="text-sm text-gray-300">{aiResponse}</p>
                <button type="button" onClick={() => setAiResponse(null)} className="mt-2 text-xs text-gray-500">
                  Закрыть
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="rounded-2xl p-4 mb-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <textarea
              value={text}
              onChange={e => {
                setText(e.target.value)
                setSubmitBlocked(false)
              }}
              placeholder="Что произошло сегодня? Как ты себя чувствуешь?.."
              rows={4}
              className="w-full bg-transparent text-white placeholder-gray-600 resize-none focus:outline-none text-base leading-relaxed"
              style={{ fontSize: '16px' }}
            />
            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
                {canUseAI ? (
                  <>
                    <Sparkles size={12} className="text-accent shrink-0" />
                    <span className="text-accent">AI-анализ</span>
                  </>
                ) : (
                  <>
                    <Lock size={12} className="shrink-0" />
                    <span>AI недоступен</span>
                  </>
                )}
              </div>
              <motion.button
                type="button"
                onClick={e => {
                  e.preventDefault()
                  void handleSubmit()
                }}
                disabled={!text.trim() || loading}
                className="p-2.5 rounded-xl disabled:opacity-40 shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #534AB7, #7F77DD)',
                  touchAction: 'manipulation',
                }}
                whileTap={{ scale: 0.9 }}
              >
                <Send size={16} />
              </motion.button>
            </div>
          </div>

          {submitBlocked && (
            <p className="text-xs text-amber-400/90 mb-2 px-1">
              Запись недоступна по лимиту. Открой Pro в разделе «Профиль».
            </p>
          )}
        </div>

        {/* Floating XP */}
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
      </div>
    </Paywall>
  )
}
