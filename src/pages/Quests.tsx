import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, History, ListTodo } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useQuests,
  useCharacter,
  useFloatingXP,
  useJournal,
  useCompletedQuests,
} from '@/hooks/useLifeQuest'
import { generateQuest } from '@/lib/ai'
import { canUse } from '@/lib/access'
import {
  insertGeneratedQuests,
  mapArchitectQuestsToRows,
  normalizeSphere,
  sphereToStatKey,
  weakestSphere,
} from '@/lib/quests'
import QuestCard from '@/components/QuestCard'
import type { User } from '@/types'
import type { Sphere } from '@/types'

interface QuestsProps {
  user: User
}

type TabId = 'active' | 'history'

const MAX_ACTIVE = 3

export default function Quests({ user }: QuestsProps) {
  const navigate = useNavigate()
  const { quests, completeQuest, loading: questsLoading, refetch: refetchQuests } = useQuests(user.id)
  const {
    quests: completedQuests,
    loading: historyLoading,
    refetch: refetchHistory,
  } = useCompletedQuests(user.id)
  const { entries, loading: journalLoading } = useJournal(user.id)
  const { character, gainXP } = useCharacter(user.id)
  const { items: xpItems, show: showXP } = useFloatingXP()

  const [tab, setTab] = useState<TabId>('active')
  const [generating, setGenerating] = useState(false)
  const [allowAi, setAllowAi] = useState<boolean | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    void canUse(user.id, 'ai_chat').then(setAllowAi)
  }, [user.id])

  useEffect(() => {
    if (!user.id || !character || questsLoading || journalLoading) return
    if (quests.length > 0) return
    if (allowAi === false) return
    if (allowAi === null) return
    if (inFlightRef.current) return

    const c = character
    let cancelled = false

    async function run() {
      inFlightRef.current = true
      setGenerating(true)
      try {
        const last5 = entries.slice(0, 5).map(e => e.content)
        const weak = weakestSphere(c)
        const statVal = c[weak]
        const summary = `Герой: ${c.name}, класс: ${c.class}, уровень: ${c.level}. Характеристики: разум ${c.mind}, тело ${c.body}, дух ${c.spirit}, ресурс ${c.resource}.`
        const generated = await generateQuest({
          recentEntries: last5,
          weakestSphere: weak,
          weakestStatValue: statVal,
          characterSummary: summary,
        })
        if (cancelled) return
        const rows = mapArchitectQuestsToRows(generated)
        if (rows.length === 0) return
        const ok = await insertGeneratedQuests(user.id, rows)
        if (ok && !cancelled) await refetchQuests()
      } catch (e) {
        console.error(e)
      } finally {
        inFlightRef.current = false
        if (!cancelled) setGenerating(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [user.id, character, questsLoading, journalLoading, quests.length, entries, allowAi, refetchQuests])

  async function handleComplete(id: string) {
    const { xp, quest } = await completeQuest(id)
    if (!quest || xp <= 0) return
    const sphere = (normalizeSphere(quest.sphere) ?? 'mind') as Sphere
    const stat = sphereToStatKey(sphere)
    await gainXP?.(xp, stat, 2)
    showXP(xp, `+${xp} XP`, 50)
    await refetchHistory()
  }

  const activeList = quests.slice(0, MAX_ACTIVE)
  const showMainLoading =
    !character ||
    journalLoading ||
    (questsLoading && quests.length === 0 && allowAi !== false)

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-safe pb-4">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white flex-1">Квесты</h1>
      </div>

      <div className="px-4 pb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            tab === 'active'
              ? 'bg-primary/40 text-white border border-accent/40'
              : 'bg-white/5 text-gray-400 border border-transparent'
          }`}
        >
          <ListTodo size={16} />
          Активные
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            tab === 'history'
              ? 'bg-primary/40 text-white border border-accent/40'
              : 'bg-white/5 text-gray-400 border border-transparent'
          }`}
        >
          <History size={16} />
          Архив
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-28 space-y-3">
        {tab === 'active' && (
          <>
            {allowAi === false && (
              <div className="rounded-2xl border border-white/10 p-4 bg-white/[0.03]">
                <p className="text-sm text-gray-400 mb-3">
                  Персональные квесты от Архитектора доступны на пробном периоде или Pro.
                </p>
                <Link
                  to="/upgrade"
                  className="block w-full py-3 rounded-xl font-semibold text-center text-white"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                >
                  Открыть доступ
                </Link>
              </div>
            )}

            {showMainLoading && (
              <div className="flex justify-center py-16">
                <motion.div
                  className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            )}

            {!showMainLoading && allowAi !== false && (
              <>
                {generating && activeList.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-6">Архитектор готовит квесты…</p>
                )}
                {!generating && activeList.length === 0 && (
                  <div className="text-center py-12 text-gray-600">
                    <p className="text-gray-400">Нет активных квестов</p>
                    <p className="text-sm mt-2">Когда Архитектор сможет — появятся новые задания.</p>
                  </div>
                )}
                {activeList.map((quest, i) => (
                  <motion.div
                    key={quest.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <QuestCard quest={quest} onComplete={handleComplete} variant="active" />
                  </motion.div>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            {historyLoading && (
              <div className="flex justify-center py-16">
                <motion.div
                  className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            )}
            {!historyLoading && completedQuests.length === 0 && (
              <p className="text-center text-gray-600 py-16">Завершённых квестов пока нет</p>
            )}
            {completedQuests.map((quest, i) => (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <QuestCard quest={quest} variant="history" />
              </motion.div>
            ))}
          </>
        )}
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
          {item.label}
        </motion.div>
      ))}
    </div>
  )
}
