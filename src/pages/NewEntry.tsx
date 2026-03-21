import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface NewEntryProps {
  user: User
}

export default function NewEntry({ user }: NewEntryProps) {
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      await supabase.from('journal_entries').insert({
        user_id: user.id,
        content: content.trim(),
        xp_gained: 50,
      })
      navigate('/journal')
    } finally {
      setSaving(false)
    }
  }

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
        <h1 className="text-lg font-bold text-white">Новая запись</h1>
      </div>

      {/* Text area */}
      <div className="flex-1 px-4">
        <textarea
          className="w-full h-64 rounded-2xl p-4 text-white placeholder-gray-600 resize-none outline-none text-sm leading-relaxed transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          placeholder="Что происходит в твоей жизни сегодня?"
          value={content}
          onChange={e => setContent(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
        <p className="text-gray-600 text-xs mt-2 px-1">+50 XP за каждую запись</p>
      </div>

      {/* Submit */}
      <div className="px-4 pb-4">
        <motion.button
          onClick={handleSubmit}
          disabled={!content.trim() || saving}
          className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#534AB7' }}
          whileTap={{ scale: 0.97 }}
        >
          <Send size={18} />
          {saving ? 'Сохраняем...' : 'Сохранить запись'}
        </motion.button>
      </div>
    </div>
  )
}
