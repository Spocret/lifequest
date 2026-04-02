interface TelegramSafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

interface TelegramWebApp {
  ready(): void
  expand(): void
  close(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  openTelegramLink?(url: string): void
  /** Opens a Telegram invoice (Stars, etc.). `url` from Bot API createInvoiceLink. */
  openInvoice?(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void
  onEvent?(eventType: string, eventHandler: () => void): void
  offEvent?(eventType: string, eventHandler: () => void): void
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  isExpanded: boolean
  /** Raw URL-encoded init data string — the most reliable Telegram context signal. */
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      username?: string
      first_name?: string
      last_name?: string
    }
    start_param?: string
  }
  /** Safe area inset from the device (notch, status bar). Available since Bot API 7.7. */
  safeAreaInset?: TelegramSafeAreaInset
  /** Safe area inset for content inside the Telegram UI (header, etc.). Available since Bot API 8.0. */
  contentSafeAreaInset?: TelegramSafeAreaInset
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}
