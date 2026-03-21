import { useLocation, useNavigate } from 'react-router-dom'
import { Home, BookOpen, Target, Repeat, User } from 'lucide-react'
import { motion } from 'framer-motion'

const NAV_ITEMS = [
  { path: '/dashboard', icon: Home, label: 'Главная' },
  { path: '/journal', icon: BookOpen, label: 'Дневник' },
  { path: '/quests', icon: Target, label: 'Квесты' },
  { path: '/habits', icon: Repeat, label: 'Привычки' },
  { path: '/referral', icon: User, label: 'Профиль' },
] as const

const ACCENT = '#534AB7'
const INACTIVE = '#6b7280'

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: '#111122',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch h-16 px-1">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const isActive =
            path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(path)

          return (
            <motion.button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center justify-center flex-1 gap-1 relative"
              whileTap={{ scale: 0.88 }}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-x-2 inset-y-1.5 rounded-xl"
                  style={{ background: 'rgba(83, 74, 183, 0.14)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                style={{ color: isActive ? ACCENT : INACTIVE }}
                className="relative"
              />
              <span
                className="text-[10px] font-medium relative leading-none"
                style={{ color: isActive ? ACCENT : INACTIVE }}
              >
                {label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
