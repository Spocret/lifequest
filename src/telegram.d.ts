interface TelegramWebApp {
  ready(): void
  expand(): void
  close(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  openTelegramLink?(url: string): void
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
