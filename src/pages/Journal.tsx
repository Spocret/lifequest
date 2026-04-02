import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Sparkles, Lock, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useJournal, useCharacter, useFeatureAccess, useFloatingXP } from '@/hooks/useLifeQuest'
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset'
import { analyzeJournalEntry } from '@/lib/ai'
import { canUse } from '@/lib/access'
import { supabaseErrorMessage } from '@/lib/supabaseError'
import Paywall from '@/components/Paywall'
import type { User } from '@/types'

interface JournalProps {
  user: User
}

export default function Journal({ user }: JournalProps) {
  const navigate = useNavigate()
  const { entries, addEntry, updateEntryAi, monthlyCount } = useJournal(user.id)
  const { gainXP } = useCharacter(user.id)
  const canUseAI = useFeatureAccess(user.id, 'journal_ai') === true
  const { items: xpItems, show: showXP } = useFloatingXP()
  const { bottomInset } = useVisualViewportInset()

  const [text, setText] = useState('')
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitBlocked, setSubmitBlocked] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!text.trim() || loading) return
    setSubmitBlocked(false)
    setSubmitError(null)
    setAiError(null)

    const allowed = await canUse(user.id, 'journal_entry')
    if (!allowed) {
      setSubmitBlocked(true)
      return
    }

    const trimmed = text.trim()
    setLoading(true)
    try {
      // Сначала сохраняем в БД — иначе долгий/зависший OpenRouter блокирует отправку (Telegram / РФ / таймауты).
      const row = await addEntry(trimmed)
      if (!row) throw new Error('Не удалось сохранить запись')

      setText('')
      await gainXP?.(50, 'spirit', 3)
      showXP(50, '+50 XP', 50)

      // Не полагаемся на useFeatureAccess (пока null — было false): спрашиваем доступ явно.
      const allowAi = await canUse(user.id, 'journal_ai')
      if (allowAi) {
        setAiLoading(true)
        try {
          const aiText = await analyzeJournalEntry(trimmed)
          const cleaned = aiText.trim()
          if (cleaned) {
            setAiResponse(cleaned)
            await updateEntryAi(row.id, cleaned)
          } else {
            setAiError('Наставник не вернул текст. Попробуй отправить ещё раз.')
          }
        } catch (e) {
          console.error(e)
          setAiError(
            e instanceof Error
              ? e.message
              : 'Не удалось получить ответ наставника. Проверь сеть или настройки ИИ на сервере.',
          )
        } finally {
          setAiLoading(false)
        }
      }
    } catch (e) {
      console.error(e)
      setSubmitError(
        supabaseErrorMessage(e, 'Не удалось сохранить. Проверь сеть и попробуй снова.'),
      )
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
            {aiLoading && (
              <motion.div
                className="mb-3 p-4 rounded-2xl flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Loader2 size={16} className="text-accent animate-spin shrink-0" />
                <span className="text-sm text-gray-400">Наставник отвечает…</span>
              </motion.div>
            )}
            {aiResponse && !aiLoading && (
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
          {submitError && (
            <p className="text-xs text-red-400/90 mb-2 px-1">{submitError}</p>
          )}
          {aiError && (
            <p className="text-xs text-amber-400/90 mb-2 px-1">{aiError}</p>
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
