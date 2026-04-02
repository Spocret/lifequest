/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENROUTER_KEY: string
  readonly VITE_TG_BOT_TOKEN: string
  readonly VITE_APP_URL: string
  /** @BotFather bot username without @; must match TELEGRAM_BOT_USERNAME on the server */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string
  readonly VITE_ADMIN_TG_ID: string
  /** Architect quote on /upgrade?fromTrial=1 */
  readonly VITE_DAY5_OFFER_TEXT?: string
  /** Telegram invoice URL for Pro (Stars) — from Bot API createInvoiceLink */
  readonly VITE_TG_PRO_INVOICE_URL?: string
  /** YooKassa (or other) payment page URL */
  readonly VITE_YOOKASSA_PAYMENT_URL?: string
  /** Личный кабинет / портал подписки (ЮКасса, бот, и т.д.) */
  readonly VITE_SUBSCRIPTION_MANAGE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
