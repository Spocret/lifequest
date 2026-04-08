import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { FeatureKey } from '@/lib/access'
import { FEATURE_TITLES, PAYWALL_CTA, PAYWALL_MESSAGE } from '@/components/paywallCopy'

function LockIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  )
}

export default function PaywallModal({
  open,
  feature,
  onClose,
}: {
  open: boolean
  feature: FeatureKey
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-3xl p-6 text-center"
            style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)' }}
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <LockIcon />
            <h2 className="text-lg font-semibold text-white mt-3">{FEATURE_TITLES[feature]}</h2>
            <p className="text-sm text-gray-400 italic max-w-xs mx-auto leading-relaxed mt-2">
              {PAYWALL_MESSAGE}
            </p>
            <Link
              to="/upgrade"
              className="mt-5 block w-full py-3.5 rounded-2xl font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)' }}
              onClick={onClose}
            >
              {PAYWALL_CTA}
            </Link>
            <button
              type="button"
              className="mt-3 text-sm text-gray-500"
              onClick={onClose}
            >
              Пока не нужно
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

