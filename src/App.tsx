import { useState, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { initTelegramAuth, type AuthResult } from './lib/auth'
import { HabitsProvider } from './hooks/useLifeQuest'
import BottomNav from './components/BottomNav'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Journal from './pages/Journal'
import NewEntry from './pages/NewEntry'
import Habits from './pages/Habits'
import Quests from './pages/Quests'
import Chat from './pages/Chat'
import Referral from './pages/Referral'
import Upgrade from './pages/Upgrade'
import Admin from './pages/Admin'

// ── Auth state ─────────────────────────────────────────────────────────────
type AuthState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: AuthResult }

// ── Screens ────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4">
      <motion.div
        className="text-5xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        ⚔️
      </motion.div>
      <motion.div
        className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <p className="text-gray-500 text-sm">Загружаем мир...</p>
    </div>
  )
}

function ErrorScreen({ message }: { message?: string }) {
  const tg = window.Telegram?.WebApp
  const debug = {
    tgExists: !!window.Telegram,
    webAppExists: !!tg,
    initData: tg?.initData ?? '(none)',
    user: tg?.initDataUnsafe?.user ?? '(none)',
    version: tg?.version ?? '(none)',
    platform: tg?.platform ?? '(none)',
  }
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="text-5xl mb-4">🛡️</div>
      <h2 className="text-xl font-bold text-white mb-2">Ошибка авторизации</h2>
      <p className="text-gray-400 text-sm mb-6">{message}</p>
      <div className="w-full bg-gray-900 rounded-xl p-4 text-left text-xs text-gray-300 font-mono break-all space-y-1">
        {Object.entries(debug).map(([k, v]) => (
          <div key={k}>
            <span className="text-yellow-400">{k}:</span>{' '}
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Layout: renders children + BottomNav (hidden on /onboarding) ───────────
function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <>
      {children}
      {pathname !== '/onboarding' && pathname !== '/upgrade' && <BottomNav />}
    </>
  )
}

// ── ProtectedRoute: redirects to /onboarding if character not set up ───────
function ProtectedRoute({ isReady, children }: { isReady: boolean; children: ReactNode }) {
  if (!isReady) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

// ── Routes ─────────────────────────────────────────────────────────────────
function AppRoutes() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor('#0a0a14')
      tg.setBackgroundColor('#0a0a14')

      const applySafeArea = () => {
        const top =
          (tg.contentSafeAreaInset?.top ?? 0) + (tg.safeAreaInset?.top ?? 0)
        document.documentElement.style.setProperty('--app-safe-top', `${top}px`)
      }
      applySafeArea()
      tg.onEvent?.('safeAreaChanged', applySafeArea)
      tg.onEvent?.('viewportChanged', applySafeArea)
    }

    initTelegramAuth()
      .then(result => setAuth({ status: 'ready', result }))
      .catch(err =>
        setAuth({ status: 'error', message: err instanceof Error ? err.message : 'Auth failed' }),
      )
  }, [])

  if (auth.status === 'loading') return <LoadingScreen />
  if (auth.status === 'error') return <ErrorScreen message={auth.message} />

  const { user, character } = auth.result
  // Character is "ready" once onboarding is complete (avatar_state leaves 'hidden')
  const isReady = character.avatar_state !== 'hidden'

  const protect = (el: ReactNode) => (
    <ProtectedRoute isReady={isReady}>{el}</ProtectedRoute>
  )

  return (
    <HabitsProvider userId={user.id}>
      <AppLayout>
      <Routes>
        {/* Root: redirect based on auth state */}
        <Route
          path="/"
          element={<Navigate to={isReady ? '/dashboard' : '/onboarding'} replace />}
        />

        {/* Onboarding (accessible before character setup) */}
        <Route path="/onboarding" element={<Onboarding userId={user.id} />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={protect(<Dashboard user={user} />)} />
        <Route path="/journal" element={protect(<Journal user={user} />)} />
        <Route path="/journal/new" element={protect(<NewEntry user={user} />)} />
        <Route path="/habits" element={protect(<Habits user={user} />)} />
        <Route path="/quests" element={protect(<Quests user={user} />)} />
        <Route path="/chat" element={protect(<Chat user={user} />)} />
        <Route path="/referral" element={protect(<Referral user={user} />)} />
        <Route path="/admin" element={protect(<Admin user={user} />)} />

        {/* Upgrade is accessible to all authenticated users */}
        <Route path="/upgrade" element={<Upgrade user={user} />} />

        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to={isReady ? '/dashboard' : '/onboarding'} replace />}
        />
      </Routes>
      </AppLayout>
    </HabitsProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
