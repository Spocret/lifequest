import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Flame, Check, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useHabits, useCharacter, useFloatingXP } from '@/hooks/useLifeQuest'
import { SPHERE_COLORS } from '@/types'
import type { User } from '@/types'

interface HabitsProps {
  user: User
}

const SPHERES = ['mind', 'body', 'spirit', 'resource'] as const
const SPHERE_LABELS = { mind: 'Разум', body: 'Тело', spirit: 'Дух', resource: 'Ресурс' }

export default function Habits({ user }: HabitsProps) {
  const navigate = useNavigate()
  const { habits, todayLogs, toggleHabit, addHabit, weekProgress } = useHabits(user.id)
  const { gainXP } = useCharacter(user.id)
  const { items: xpItems, show: showXP } = useFloatingXP()

  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSphere, setNewSphere] = useState<typeof SPHERES[number]>('mind')

  async function handleToggle(id: string) {
    const done = await toggleHabit(id)
    if (done) {
      await gainXP?.(30, newSphere, 1)
      showXP(30, '+30 XP', 50)
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return
    await addHabit(newName.trim(), newSphere)
    setNewName('')
    setShowAdd(false)
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white flex-1">Привычки</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="p-2 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Progress */}
      <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: '#534AB722', border: '1px solid #534AB744' }}>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-300">Сегодня выполнено</span>
          <span className="text-accent font-bold">{weekProgress}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #534AB7, #7F77DD)' }}
            animate={{ width: `${weekProgress}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>

      {/* Habits list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-8 space-y-3">
        {habits.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <Flame size={40} className="mx-auto mb-3 opacity-30" />
            <p>Добавь первую привычку</p>
          </div>
        )}
        {habits.map(habit => {
          const done = todayLogs[habit.id] ?? false
          const color = SPHERE_COLORS[habit.sphere as keyof typeof SPHERE_COLORS] ?? '#7F77DD'
          return (
            <motion.div
              key={habit.id}
              className="flex items-center gap-3 rounded-2xl p-4"
              style={{
                background: done ? `${color}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${done ? color + '44' : 'rgba(255,255,255,0.08)'}`,
              }}
              layout
            >
              <motion.button
                onClick={() => handleToggle(habit.id)}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: done ? color : 'rgba(255,255,255,0.08)' }}
                whileTap={{ scale: 0.85 }}
              >
                {done && <Check size={16} className="text-white" />}
              </motion.button>
              <div className="flex-1">
                <p className={`font-medium ${done ? 'line-through text-gray-500' : 'text-white'}`}>
                  {habit.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color }}>{SPHERE_LABELS[habit.sphere as keyof typeof SPHERE_LABELS]}</span>
                  {habit.streak > 0 && (
                    <span className="text-xs text-orange-400 flex items-center gap-0.5">
                      <Flame size={10} /> {habit.streak}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
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

      {/* Add habit sheet */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6"
              style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Новая привычка</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 rounded-full bg-white/10">
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Название привычки..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 mb-4"
                autoFocus
              />
              <div className="flex gap-2 flex-wrap mb-6">
                {SPHERES.map(s => (
                  <button
                    key={s}
                    onClick={() => setNewSphere(s)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: newSphere === s ? SPHERE_COLORS[s] + '33' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${newSphere === s ? SPHERE_COLORS[s] : 'transparent'}`,
                      color: newSphere === s ? SPHERE_COLORS[s] : '#9ca3af',
                    }}
                  >
                    {SPHERE_LABELS[s]}
                  </button>
                ))}
              </div>
              <motion.button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="w-full py-4 rounded-2xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
                whileTap={{ scale: 0.97 }}
              >
                Добавить
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
