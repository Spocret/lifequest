import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { usePlan, useTelegramTheme } from '@/hooks/useLifeQuest'
import type { User } from '@/types'

interface UpgradeProps {
  user: User
}

const DEFAULT_DAY5_OFFER =
  'Пять дней — лишь тень того, что открывается, когда ты не останавливаешься. Продолжишь — или дашь Тени выиграть?'

const PRO_FEATURES: string[] = [
  'ИИ-разбор каждой записи в дневнике',
  'Персональные ИИ-квесты от Архитектора',
  'ИИ-наставник — диалог без лимита',
  'Еженедельные отчёты и инсайты',
  'Безлимит записей в дневнике',
  'Безлимит привычек',
  'Полная история, архив и аналитика',
]

function readFromTrial(searchParams: URLSearchParams): boolean {
  const v = searchParams.get('fromTrial')
  return v === '1' || v === 'true' || v === 'yes'
}

function formatProEnd(iso: string | null | undefined): string | null {
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

export default function Upgrade({ user }: UpgradeProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromTrial = readFromTrial(searchParams)
  const { isPro, loading: planLoading, proEndsAt, proDaysLeft } = usePlan(user.id)
  const { haptic } = useTelegramTheme()
  const manageUrl = (import.meta.env.VITE_SUBSCRIPTION_MANAGE_URL as string | undefined)?.trim()

  const openManageSubscription = useCallback(() => {
    if (!manageUrl) return
    const tg = window.Telegram?.WebApp
    if (manageUrl.includes('t.me/') && tg?.openTelegramLink) {
      tg.openTelegramLink(manageUrl)
      return
    }
    window.open(manageUrl, '_blank', 'noopener,noreferrer')
  }, [manageUrl])

  const day5OfferText = (import.meta.env.VITE_DAY5_OFFER_TEXT as string | undefined)?.trim() || DEFAULT_DAY5_OFFER
  const starsInvoiceUrl = (import.meta.env.VITE_TG_PRO_INVOICE_URL as string | undefined)?.trim()
  const yookassaUrl = (import.meta.env.VITE_YOOKASSA_PAYMENT_URL as string | undefined)?.trim()

  const payWithStars = useCallback(() => {
    const tg = window.Telegram?.WebApp
    if (!starsInvoiceUrl) {
      window.alert('Ссылка на оплату Stars ещё не настроена (VITE_TG_PRO_INVOICE_URL).')
      haptic.error()
      return
    }
    if (tg?.openInvoice) {
      tg.openInvoice(starsInvoiceUrl, status => {
        if (status === 'paid') haptic.success()
        else if (status === 'failed') haptic.error()
      })
      return
    }
    window.open(starsInvoiceUrl, '_blank', 'noopener,noreferrer')
  }, [starsInvoiceUrl, haptic])

  const payWithYookassa = useCallback(() => {
    if (!yookassaUrl) {
      window.alert('Страница оплаты ЮКасса ещё не настроена (VITE_YOOKASSA_PAYMENT_URL).')
      haptic.error()
      return
    }
    window.location.assign(yookassaUrl)
  }, [yookassaUrl, haptic])

  return (
    <div className="min-h-dvh bg-[#05050c] flex flex-col safe-bottom">
      <div className="flex items-center gap-3 px-4 pt-safe pb-4 shrink-0">
        <motion.button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft size={20} className="text-white" />
        </motion.button>
        <h1 className="text-lg font-bold text-white">LifeQuest Pro</h1>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5 pb-8">
        {planLoading ? (
          <div className="flex flex-1 justify-center items-center py-24">
            <motion.div
              className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : (
          <>
        {fromTrial && (
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2, 3, 4].map(i => (
                <motion.span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: '#7c3aed' }}
                  initial={{ scale: 0.6, opacity: 0.4 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    boxShadow: [
                      '0 0 0px rgba(124, 58, 237, 0.3)',
                      '0 0 14px rgba(167, 139, 250, 0.9)',
                      '0 0 0px rgba(124, 58, 237, 0.3)',
                    ],
                  }}
                  transition={{
                    delay: i * 0.08,
                    duration: 1.8,
                    repeat: Infinity,
                    repeatDelay: 0.4,
                  }}
                />
              ))}
            </div>

            <motion.div
              className="relative flex items-center justify-center"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <motion.div
                className="absolute rounded-full w-24 h-24"
                style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.45), transparent 70%)' }}
                animate={{
                  scale: [1, 1.12, 1],
                  boxShadow: [
                    '0 0 0px rgba(139, 92, 246, 0)',
                    '0 0 28px rgba(139, 92, 246, 0.65)',
                    '0 0 0px rgba(139, 92, 246, 0)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              />
              <motion.div
                className="relative text-4xl font-bold text-white tabular-nums"
                style={{ textShadow: '0 0 24px rgba(167, 139, 250, 0.8)' }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                ↑
              </motion.div>
            </motion.div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet-300/90 text-center">Новый уровень пути</p>

            <blockquote className="text-center text-sm sm:text-base text-violet-100/90 italic leading-relaxed max-w-md px-2 border-l-2 border-violet-500/40 pl-4">
              {day5OfferText}
            </blockquote>
          </motion.div>
        )}

        <motion.section
          className="rounded-3xl p-5 sm:p-6"
          style={{
            background: 'linear-gradient(145deg, rgba(83,74,183,0.22), rgba(10,10,20,0.98))',
            border: '1px solid rgba(127, 119, 221, 0.35)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: fromTrial ? 0.15 : 0 }}
        >
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-white mb-1">Pro</h2>
            <p className="text-gray-400 text-sm">Всё, что нужно герою на полном пути</p>
            {isPro && (
              <div className="mt-3 space-y-1 text-sm">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: '#534AB733', color: '#a09af5' }}
                >
                  ✓ Подписка активна
                </div>
                {proDaysLeft !== null && proEndsAt && (
                  <>
                    <p className="text-gray-300">
                      Осталось: <span className="text-white font-semibold">{proDaysLeft}</span> дн.
                    </p>
                    <p className="text-xs text-gray-500">До {formatProEnd(proEndsAt)}</p>
                  </>
                )}
                {proDaysLeft === null && (
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">
                    После оплаты здесь будет дата окончания периода.
                  </p>
                )}
                {isPro && manageUrl && (
                  <button
                    type="button"
                    onClick={openManageSubscription}
                    className="text-xs text-violet-300 underline-offset-2 hover:underline"
                  >
                    Управление подпиской
                  </button>
                )}
              </div>
            )}
          </div>

          <ul className="space-y-2.5 mb-6 text-left">
            {PRO_FEATURES.map(line => (
              <li key={line} className="flex gap-2 text-sm text-gray-100 leading-snug">
                <span className="text-violet-400 shrink-0 select-none" aria-hidden>
                  ✦
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="text-center mb-6 pt-2 border-t border-white/10">
            <p className="text-2xl font-bold text-white tracking-tight">490 ₽ / месяц</p>
            <p className="text-gray-500 text-xs mt-1">отмена в любой момент</p>
            <p className="text-gray-500 text-xs mt-2 max-w-sm mx-auto leading-relaxed">
              Подписка на 30 дней; при продлении срок добавляется к текущему.
            </p>
          </div>

          <div className="flex flex-col gap-3">
              {isPro && (
                <p className="text-center text-sm text-gray-400 mb-1">
                  {proDaysLeft !== null ? 'Продлить месяц — срок суммируется с активной подпиской.' : 'Оплата месяца — появится дата в профиле.'}
                </p>
              )}
              <motion.button
                type="button"
                onClick={payWithStars}
                className="w-full py-4 rounded-2xl font-bold text-white text-base flex flex-col items-center justify-center gap-0.5"
                style={{ background: 'linear-gradient(135deg, #534AB7, #7B72E0)' }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>✦</span>
                  {isPro ? 'Продлить через Stars' : 'Продолжить путь'}
                </span>
                <span className="text-xs font-normal text-white/75">Telegram Stars — быстро, без юрлица</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={payWithYookassa}
                className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm border border-white/15 bg-white/[0.06]"
                whileTap={{ scale: 0.98 }}
              >
                {isPro ? 'ЮКасса — продлить подписку' : 'ЮКасса — оплата картой'}
              </motion.button>

              {fromTrial && !isPro && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-3 text-sm text-gray-500 hover:text-gray-400 transition-colors"
                >
                  «Тень подождёт» → Free
                </button>
              )}
            </div>
        </motion.section>
          </>
        )}
      </div>
    </div>
  )
}
