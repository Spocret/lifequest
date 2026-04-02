/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENROUTER_KEY: string
  readonly VITE_TG_BOT_TOKEN: string
  readonly VITE_APP_URL: string
  readonly VITE_ADMIN_TG_ID: string
  /** Architect quote on /upgrade?fromTrial=1 */
  readonly VITE_DAY5_OFFER_TEXT?: string
  /** Telegram invoice URL for Pro (Stars) — from Bot API createInvoiceLink */
  readonly VITE_TG_PRO_INVOICE_URL?: string
  /** YooKassa (or other) payment page URL */
  readonly VITE_YOOKASSA_PAYMENT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
