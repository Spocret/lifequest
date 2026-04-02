import { motion } from 'framer-motion'
import { ArrowLeft, Copy, Users, Gift, Check, Share2, Crown, Sparkles, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { usePlan, useReferral } from '@/hooks/useLifeQuest'
import { buildReferralLink } from '@/lib/referral'
import { isAdminUser } from '@/lib/admin'
import type { User } from '@/types'

interface ReferralProps {
  user: User
}

function formatTrialEndDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

export default function Referral({ user }: ReferralProps) {
  const navigate = useNavigate()
  const { stats, loading } = useReferral(user.id)
  const { loading: planLoading, isTrialActive, isPro, daysLeft, trialEndsAt, plan, proEndsAt, proDaysLeft } =
    usePlan(user.id)
  const [copied, setCopied] = useState(false)
  const showAdmin = isAdminUser(user)

  const manageUrl = (import.meta.env.VITE_SUBSCRIPTION_MANAGE_URL as string | undefined)?.trim()

  const openManageSubscription = () => {
    if (!manageUrl) return
    const tg = window.Telegram?.WebApp
    if (manageUrl.includes('t.me/') && tg?.openTelegramLink) {
      tg.openTelegramLink(manageUrl)
      return
    }
    window.open(manageUrl, '_blank', 'noopener,noreferrer')
  }

  const upgradeTo = useMemo(() => {
    if (isTrialActive && daysLeft === 1) return '/upgrade?fromTrial=1'
    return '/upgrade'
  }, [isTrialActive, daysLeft])

  const trialEndLabel = formatTrialEndDate(trialEndsAt)
  const proEndLabel = formatTrialEndDate(proEndsAt)

  const link = stats?.code ? buildReferralLink(stats.code) : ''
  const shareText = `Прокачиваю себя как RPG. 7 дней бесплатно → ${link}`

  const nextLabel = stats?.nextMilestone
    ? `До следующей награды: ${stats.nextMilestone.remaining}`
    : 'Все награды получены'

  function copyLink() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col px-4 pt-safe pb-[calc(4rem+env(safe-area-inset-bottom,0px)+1.5rem)]">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Профиль</h1>
          <p className="text-xs text-gray-500 mt-0.5">Союзники и подписка</p>
        </div>
      </div>

      {/* Subscription */}
      <motion.section
        className="rounded-3xl p-5 mb-4"
        style={{
          background: 'linear-gradient(145deg, rgba(83,74,183,0.2), rgba(18,18,31,0.95))',
          border: '1px solid rgba(127, 119, 221, 0.35)',
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(127, 119, 221, 0.2)' }}
          >
            <Sparkles size={22} className="text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">Подписка</h2>
            {planLoading ? (
              <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ) : isPro ? (
              <>
                <p className="text-lg font-bold text-white">LifeQuest Pro</p>
                <p className="text-sm text-gray-400 mt-1">Полный доступ: ИИ, квесты, дневник без лимитов.</p>
                <p className="text-xs text-violet-300/90 mt-2">Подписка активна</p>
                {proDaysLeft !== null && proEndLabel && (
                  <>
                    <p className="text-sm text-gray-300 mt-2">
                      Осталось: <span className="text-white font-semibold">{proDaysLeft}</span> дн.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">До {proEndLabel}</p>
                  </>
                )}
                {proDaysLeft === null && (
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Период оплаты не привязан к дате в базе — после первой оплаты через приложение появится дата
                    окончания.
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  {manageUrl && (
                    <motion.button
                      type="button"
                      onClick={openManageSubscription}
                      className="w-full py-3 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2 border border-white/15 bg-white/[0.06]"
                      whileTap={{ scale: 0.98 }}
                    >
                      <ExternalLink size={16} />
                      Управление подпиской
                    </motion.button>
                  )}
                  <motion.button
                    type="button"
                    onClick={() => navigate('/upgrade')}
                    className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Продлить Pro
                  </motion.button>
                </div>
              </>
            ) : isTrialActive ? (
              <>
                <p className="text-lg font-bold text-white">Пробный период</p>
                <p className="text-sm text-gray-300 mt-1">
                  {daysLeft === 1 ? (
                    <span className="text-amber-300 font-medium">Остался последний день</span>
                  ) : (
                    <>
                      Осталось дней: <span className="text-white font-semibold">{daysLeft}</span>
                    </>
                  )}
                </p>
                {trialEndLabel && (
                  <p className="text-xs text-gray-500 mt-1">До {trialEndLabel}</p>
                )}
                <motion.button
                  type="button"
                  onClick={() => navigate(upgradeTo)}
                  className="mt-4 w-full py-3.5 rounded-2xl font-semibold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Оформить Pro — 490 ₽/мес
                </motion.button>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-white">
                  {plan?.isTrialExpired ? 'Пробный период закончился' : 'Бесплатный план'}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {plan?.isTrialExpired
                    ? 'ИИ, квесты и расширенные функции доступны в Pro.'
                    : 'Ограничения по записям и привычкам. Pro снимает лимиты.'}
                </p>
                <motion.button
                  type="button"
                  onClick={() => navigate('/upgrade')}
                  className="mt-4 w-full py-3.5 rounded-2xl font-semibold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Оформить Pro — 490 ₽/мес
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.section>

      {/* Arch message */}
      <motion.div
        className="rounded-3xl p-6 mb-4"
        style={{ background: 'linear-gradient(135deg, #534AB733, #12121f)', border: '1px solid #534AB755' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start gap-3">
          <div className="text-4xl leading-none">🏛️</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white mb-1">Архитектор Гильдии</h2>
            <p className="text-gray-400 text-sm">
              Пригласи союзников. Награда активируется, когда они пройдут свой первый квест.
            </p>
            {stats && (
              <div className="mt-3 text-xs text-gray-300">
                <span className="text-gray-400">{nextLabel}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Users size={20} className="text-accent mb-2" />
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-400">приглашено</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Gift size={20} className="text-accent mb-2" />
            <div className="text-2xl font-bold text-white">{stats.daysEarned}</div>
            <div className="text-xs text-gray-400">дней получено</div>
          </div>
        </div>
      )}

      {/* Referral code */}
      {stats && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs text-gray-400 mb-2">Твоя ссылка</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white truncate max-w-[55%]">{link}</span>
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
          <p className="text-xs text-gray-500 mt-2">
            Код: <span className="text-gray-300 font-mono">{stats.code}</span>
          </p>
        </div>
      )}

      {/* Milestones */}
      {stats && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-white">Вехи</div>
            <div className="text-xs text-gray-400">активировано: {stats.activated}</div>
          </div>
          <div className="space-y-2">
            {stats.milestones.map(m => (
              <div key={m.n} className="flex items-center justify-between rounded-xl px-3 py-2 bg-black/20 border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    {m.status === 'reached' ? <Check size={16} className="text-green-400" /> : <Crown size={16} className="text-gray-400" />}
                  </div>
                  <div>
                    <div className="text-sm text-white">
                      {m.n} союзник{m.n === 1 ? '' : m.n < 5 ? 'а' : 'ов'}
                      <span className="text-gray-400"> · +{m.reward.days}д</span>
                    </div>
                    {(m.reward.title || m.reward.artifact) && (
                      <div className="text-xs text-gray-400">
                        {m.reward.title ? `Титул: ${m.reward.title}` : null}
                        {m.reward.title && m.reward.artifact ? ' · ' : null}
                        {m.reward.artifact ? `Артефакт: ${m.reward.artifact}` : null}
                      </div>
                    )}
                  </div>
                </div>
                <div className={`text-xs ${m.status === 'reached' ? 'text-green-400' : 'text-gray-500'}`}>
                  {m.status === 'reached' ? 'получено' : 'впереди'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdmin && (
        <motion.button
          type="button"
          onClick={() => navigate('/admin')}
          className="w-full py-3 rounded-2xl font-medium text-sm mb-3 text-white border border-white/10"
          style={{ background: 'rgba(83, 74, 183, 0.2)' }}
          whileTap={{ scale: 0.98 }}
        >
          Админка — статистика
        </motion.button>
      )}

      {/* Share button */}
      <motion.button
        onClick={() => {
          const tg = window.Telegram?.WebApp
          if (tg) {
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`
            tg.openTelegramLink?.(shareUrl)
          }
        }}
        className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
        whileTap={{ scale: 0.97 }}
      >
        <Share2 size={18} />
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
