import { motion } from 'framer-motion'
import { ArrowLeft, Copy, Users, Gift, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useReferral } from '@/hooks/useLifeQuest'
import { buildReferralLink } from '@/lib/referral'
import type { User } from '@/types'

interface ReferralProps {
  user: User
}

export default function Referral({ user }: ReferralProps) {
  const navigate = useNavigate()
  const { stats, loading } = useReferral(user.id)
  const [copied, setCopied] = useState(false)

  const link = stats ? buildReferralLink(stats.code) : ''

  function copyLink() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col px-4 pt-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white">Реферальная программа</h1>
      </div>

      {/* Hero */}
      <motion.div
        className="rounded-3xl p-6 mb-4 text-center"
        style={{ background: 'linear-gradient(135deg, #534AB733, #12121f)', border: '1px solid #534AB755' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-5xl mb-4">🎁</div>
        <h2 className="text-lg font-bold text-white mb-2">Приглашай друзей</h2>
        <p className="text-gray-400 text-sm">
          За каждого друга ты получаешь <span className="text-accent font-medium">+3 дня Pro</span>
        </p>
      </motion.div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Users size={20} className="text-accent mb-2" />
            <div className="text-2xl font-bold text-white">{stats.count}</div>
            <div className="text-xs text-gray-400">приглашено</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Gift size={20} className="text-accent mb-2" />
            <div className="text-2xl font-bold text-white">{stats.bonusDays}</div>
            <div className="text-xs text-gray-400">бонусных дней</div>
          </div>
        </div>
      )}

      {/* Referral code */}
      {stats && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs text-gray-400 mb-2">Твой реферальный код</p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-white tracking-widest">{stats.code}</span>
            <motion.button
              onClick={copyLink}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ background: copied ? '#22c55e22' : '#534AB733', color: copied ? '#4ade80' : '#7F77DD' }}
              whileTap={{ scale: 0.95 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Скопировано' : 'Копировать'}
            </motion.button>
          </div>
          <p className="text-xs text-gray-600 mt-2 truncate">{link}</p>
        </div>
      )}

      {/* Share button */}
      <motion.button
        onClick={() => {
          const tg = window.Telegram?.WebApp
          if (tg) {
            tg.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Присоединяйся к LifeQuest — прокачивай жизнь как RPG!')}`)
          }
        }}
        className="w-full py-4 rounded-2xl font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
        whileTap={{ scale: 0.97 }}
      >
        Поделиться в Telegram
      </motion.button>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  )
}
