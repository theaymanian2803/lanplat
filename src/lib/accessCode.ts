const ACCESS_CODE_KEY = 'lingovault_access_code'

export const DEFAULT_ACCESS_CODE = '123123123'

export function getAccessCode(): string {
  try {
    const stored = localStorage.getItem(ACCESS_CODE_KEY)
    if (stored && stored.trim()) return stored.trim()
  } catch {
    // storage unavailable — fall back to default
  }
  return DEFAULT_ACCESS_CODE
}

export function isCustomAccessCode(): boolean {
  try {
    const stored = localStorage.getItem(ACCESS_CODE_KEY)
    return !!stored && stored.trim().length > 0
  } catch {
    return false
  }
}

export function setAccessCode(code: string): void {
  localStorage.setItem(ACCESS_CODE_KEY, code.trim())
}

export function resetAccessCode(): void {
  localStorage.removeItem(ACCESS_CODE_KEY)
}