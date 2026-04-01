/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENROUTER_KEY: string
  readonly VITE_TG_BOT_TOKEN: string
  readonly VITE_APP_URL: string
  readonly VITE_ADMIN_TG_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
