import { useEffect, useState } from 'react'

/** Bottom gap (e.g. software keyboard) between layout and visual viewport, in px. */
export interface VisualViewportInset {
  bottomInset: number
  /** Visible viewport height (Telegram / mobile keyboard). */
  height: number
}

/**
 * Keeps bottom-anchored UI above the on-screen keyboard (Telegram WebApp, iOS Safari).
 */
export function useVisualViewportInset(): VisualViewportInset {
  const [state, setState] = useState<VisualViewportInset>(() => ({
    bottomInset: 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const bottomInset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height)
      setState({ bottomInset, height: vv.height })
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return state
}
