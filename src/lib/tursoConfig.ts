const STORAGE_KEY = 'lingo_turso_config'
const DISMISS_KEY = 'lingo_db_banner_dismissed'

export interface TursoConfig {
  url: string
  token: string
}

const baked: TursoConfig = {
  url: import.meta.env.VITE_TURSO_DATABASE_URL ?? '',
  token: import.meta.env.VITE_TURSO_AUTH_TOKEN ?? '',
}

function getStoredConfig(): TursoConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TursoConfig>
    if (
      typeof parsed.url === 'string' &&
      parsed.url.trim() &&
      typeof parsed.token === 'string' &&
      parsed.token.trim()
    ) {
      return { url: parsed.url.trim(), token: parsed.token.trim() }
    }
    return null
  } catch {
    return null
  }
}

export function getTursoConfig(): TursoConfig {
  return getStoredConfig() ?? baked
}

export function saveTursoConfig(cfg: TursoConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: cfg.url.trim(), token: cfg.token.trim() }))
}

export function clearTursoConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isUsingCustomConfig(): boolean {
  return getStoredConfig() !== null
}

export function shouldShowSetupBanner(): boolean {
  if (isUsingCustomConfig()) return false
  try {
    return localStorage.getItem(DISMISS_KEY) !== 'true'
  } catch {
    return false
  }
}

export function dismissSetupBanner(): void {
  try {
    localStorage.setItem(DISMISS_KEY, 'true')
  } catch {
    // storage unavailable — nothing to persist
  }
}
