import { useMemo, useRef, useState } from 'react'
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { chatWithMemory, consumeOpenRouterStream, type Message as AiMessage } from '@/lib/ai'
import Paywall from '@/components/Paywall'
import type { User } from '@/types'
import { supabase } from '@/lib/supabase'

interface ChatProps {
  user: User
}

type Message = AiMessage

export default function Chat({ user }: ChatProps) {
  const navigate = useNavigate()
  const { bottomInset } = useVisualViewportInset()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useMemo(() => {
    return () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const suggestedQuestions = useMemo(
    () => [
      'Что меня беспокоит последний месяц?',
      'Почему я срываю привычки?',
      'Как я себя чувствую по понедельникам?',
    ],
    [],
  )

  async function fetchLast20Entries(): Promise<string[]> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(20)
    if (error) {
      console.error('last20Entries:', error)
      return []
    }
    return (data ?? []).map(r => r.content)
  }

  async function saveExchangeToDb(userText: string, assistantText: string) {
    const { error: chatErr } = await supabase.from('chat_exchanges').insert({
      user_id: user.id,
      user_message: userText,
      assistant_message: assistantText,
    })
    if (!chatErr) return

    const { error: fallbackErr } = await supabase.from('journal_entries').insert({
      user_id: user.id,
      content: userText,
      ai_response: assistantText,
      sphere: 'chat',
      xp_gained: 0,
    })
    if (fallbackErr) {
      console.error('saveExchangeToDb:', { chatErr, fallbackErr })
    }
  }

  async function handleSend(explicitText?: string) {
    const text = (explicitText ?? input).trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)
    scrollToBottom()

    try {
      const last20Entries = await fetchLast20Entries()
      const history = [...messages, userMsg].slice(-20)
      const stream = await chatWithMemory(history, last20Entries)

      const fullReply = await consumeOpenRouterStream(stream, delta => {
        setMessages(prev => {
          const next = [...prev]
          const lastIdx = next.length - 1
          if (lastIdx >= 0 && next[lastIdx]?.role === 'assistant') {
            next[lastIdx] = { role: 'assistant', content: (next[lastIdx]?.content ?? '') + delta }
          }
          return next
        })
        scrollToBottom()
      })

      await saveExchangeToDb(userMsg.content, fullReply.trim())
    } catch (e) {
      console.error(e)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Произошла ошибка. Попробуй ещё раз.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Paywall feature="ai_chat" userId={user.id}>
    <div className="min-h-dvh bg-background flex flex-col pb-16">
      <div className="flex items-center gap-3 px-4 pt-safe pb-4 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <Sparkles size={16} className="text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">ИИ-Наставник</p>
            <p className="text-xs text-green-400">онлайн</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="pt-10">
            <p className="text-sm text-gray-400 mb-3">Можно начать с вопроса:</p>
            <div className="flex flex-col gap-2">
              {suggestedQuestions.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="text-left rounded-2xl px-4 py-3 text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {msg.role === 'assistant' ? (
                <div className="flex items-end gap-2 max-w-[90%]">
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={14} className="text-accent" />
                  </div>
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      borderRadius: '18px 18px 18px 4px',
                    }}
                  >
                    {msg.content}
                    {loading && i === messages.length - 1 && msg.content.length === 0 && (
                      <motion.span
                        className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-accent"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
                  style={{
                    background: 'linear-gradient(135deg, #534AB7, #7F77DD)',
                    color: '#fff',
                    borderRadius: '18px 18px 4px 18px',
                  }}
                >
                  {msg.content}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div
        className="px-4 pt-3 border-t border-white/5"
        style={{
          paddingBottom: `calc(${bottomInset}px + 1.5rem + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Напиши сообщение..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 text-sm disabled:opacity-50"
          />
          <motion.button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-3 rounded-2xl disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
            whileTap={{ scale: 0.9 }}
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>

    </div>
    </Paywall>
  )
}
