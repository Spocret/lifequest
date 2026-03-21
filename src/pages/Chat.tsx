import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Sparkles, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlan } from '@/hooks/useLifeQuest'
import { chatWithMentor } from '@/lib/ai'
import Paywall from '@/components/Paywall'
import type { User } from '@/types'

interface ChatProps {
  user: User
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Chat({ user }: ChatProps) {
  const navigate = useNavigate()
  const { isPro, isTrialActive } = usePlan(user.id)
  const canUseChat = isPro || isTrialActive

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Приветствую, герой! Я твой ИИ-наставник. Готов помочь тебе на пути саморазвития. О чём ты хочешь поговорить?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return
    if (!canUseChat) {
      setPaywallOpen(true)
      return
    }

    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.slice(-10)
      const reply = await chatWithMentor(history, userMsg.content)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Произошла ошибка. Попробуй ещё раз.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
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

      {!canUseChat && (
        <motion.div
          className="mx-4 mt-4 p-3 rounded-2xl flex items-center gap-2"
          style={{ background: '#534AB722', border: '1px solid #534AB744' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Lock size={14} className="text-accent" />
          <p className="text-xs text-gray-300">
            Чат доступен в Trial и Pro. <button onClick={() => setPaywallOpen(true)} className="text-accent underline">Разблокировать</button>
          </p>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div
                className="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
                style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #534AB7, #7F77DD)'
                    : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                }}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white/6 rounded-2xl px-4 py-3 flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-accent"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-6 pt-3 border-t border-white/5">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={canUseChat ? 'Напиши сообщение...' : 'Доступно в Pro'}
            disabled={!canUseChat}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 text-sm disabled:opacity-50"
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || loading || !canUseChat}
            className="p-3 rounded-2xl disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
            whileTap={{ scale: 0.9 }}
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>

      <Paywall
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        featureName="Чат с наставником"
        isTrialAvailable={false}
        onUpgrade={() => setPaywallOpen(false)}
      />
    </div>
  )
}
