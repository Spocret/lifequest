import { useState, useCallback } from 'react'
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { askQuestion, consumeOpenRouterStream } from '@/lib/ai'
import { canUse } from '@/lib/access'
import Paywall from '@/components/Paywall'
import CharacterReveal from '@/components/CharacterReveal'
import { useCharacter, useFloatingXP } from '@/hooks/useLifeQuest'
import type { User } from '@/types'

interface NewEntryProps {
  user: User
}

export default function NewEntry({ user }: NewEntryProps) {
  const navigate = useNavigate()
  const { bottomInset } = useVisualViewportInset()
  const { character, loading: charLoading, gainXP, completeFirstJournalReveal } = useCharacter(user.id)
  const { items: xpItems, show: showXP } = useFloatingXP()

  const [content, setContent] = useState('')
  const [phase, setPhase] = useState<'edit' | 'result'>('edit')
  const [savedContent, setSavedContent] = useState('')
  const [streamedReply, setStreamedReply] = useState('')
  const [streamingDone, setStreamingDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showReveal, setShowReveal] = useState(false)

  const finalizeReveal = useCallback(async () => {
    await completeFirstJournalReveal?.()
  }, [completeFirstJournalReveal])

  async function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed || saving || !character) return
    if (!(await canUse(user.id, 'journal_entry'))) {
      navigate('/upgrade')
      return
    }

    setSaving(true)
    setStreamedReply('')
    setStreamingDone(false)

    try {
      const [countRes, entriesRes] = await Promise.all([
        supabase
          .from('journal_entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('journal_entries')
          .select('content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(20),
      ])

      const isFirstEver = (countRes.count ?? 0) === 0
      const recentEntries = (entriesRes.data ?? []).map(e => e.content).join('\n---\n')

      const { data: inserted, error: insertErr } = await supabase
        .from('journal_entries')
        .insert({
          user_id: user.id,
          content: trimmed,
          xp_gained: 50,
        })
        .select('id')
        .single()

      if (insertErr || !inserted) throw insertErr ?? new Error('Insert failed')

      setSavedContent(trimmed)
      setPhase('result')

      let fullReply = ''
      try {
        const stream = await askQuestion(trimmed, recentEntries)
        fullReply = await consumeOpenRouterStream(stream, delta => {
          setStreamedReply(prev => prev + delta)
        })
      } catch (e) {
        console.error(e)
        fullReply = 'Связь с наставником прервалась. Запись сохранена.'
        setStreamedReply(fullReply)
      }

      setStreamingDone(true)

      await supabase.from('journal_entries').update({ ai_response: fullReply }).eq('id', inserted.id)

      showXP(50, 'XP', 38)
      setTimeout(() => showXP(3, 'Дух', 62), 140)

      await gainXP?.(50, 'spirit', 3)

      const shouldReveal = isFirstEver && character.avatar_state !== 'revealed'
      if (shouldReveal) {
        setShowReveal(true)
      } else {
        window.setTimeout(() => navigate('/journal'), 2200)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paywall feature="journal_entry" userId={user.id}>
      <div
        className="min-h-dvh flex flex-col bg-black text-white"
        style={{ background: '#030305' }}
      >
        {charLoading || !character ? (
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : (
          <>
            <div className="flex-shrink-0 flex items-center gap-2 px-3 pt-safe pb-2">
              <motion.button
                type="button"
                onClick={() => (phase === 'edit' ? navigate(-1) : navigate('/journal'))}
                className="p-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                whileTap={{ scale: 0.92 }}
              >
                <ArrowLeft size={20} className="text-white" />
              </motion.button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col px-4">
              {phase === 'edit' ? (
                <div className="flex-1 flex flex-col min-h-0 relative pb-8">
                  <textarea
                    className="w-full flex-1 min-h-[200px] bg-transparent text-white placeholder:text-gray-500 resize-none outline-none border-none p-0 text-base leading-relaxed"
                    style={{ fontSize: 16 }}
                    placeholder="Пиши что думаешь..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  <span className="absolute bottom-0 right-0 text-xs text-gray-500 tabular-nums pointer-events-none">
                    {content.length}
                  </span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pb-4">
                  <p className="text-base text-gray-100 whitespace-pre-wrap leading-relaxed">{savedContent}</p>
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-violet-400" />
                      <span className="text-xs font-medium text-violet-300">Архитектор</span>
                    </div>
                    <p className="text-base text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {streamedReply}
                      {!streamingDone && phase === 'result' && (
                        <motion.span
                          className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-violet-400"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {phase === 'edit' && (
              <div
                className="flex-shrink-0 px-4"
                style={{
                  paddingBottom: `calc(${bottomInset}px + 1rem + env(safe-area-inset-bottom, 0px))`,
                }}
              >
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!content.trim() || saving}
                  className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                  style={{ background: '#534AB7' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Send size={18} />
                  {saving ? 'Сохраняем…' : 'Отправить'}
                </motion.button>
              </div>
            )}

            {showReveal && character && (
              <CharacterReveal
                character={character}
                onFinalize={finalizeReveal}
                onShowQuestXP={() => showXP(150, 'XP', 50)}
              />
            )}

            <AnimatePresence>
              {xpItems.map(item => (
                <motion.div
                  key={item.id}
                  className="fixed font-bold text-lg pointer-events-none z-50"
                  style={{
                    left: `${item.x}%`,
                    bottom: '38%',
                    color: item.label === 'Дух' ? '#FF9800' : '#a78bfa',
                  }}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -72 }}
                  transition={{ duration: 1.35, ease: 'easeOut' }}
                >
                  +{item.amount} {item.label}
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
    </Paywall>
  )
}
