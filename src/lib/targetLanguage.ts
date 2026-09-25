const KEY = 'lingovault_target_language'

/**
 * The language a visitor picked on the public landing page, before they ever authenticated.
 * `localStorage` rather than `sessionStorage` because this is a durable preference, not an
 * unlock flag, and it is written while the visitor is still anonymous.
 */
export const getTargetLanguage = (): string | null => localStorage.getItem(KEY)

/** Stores the database `languages.name` value, which is what the app filters on. */
export const setTargetLanguage = (name: string): void => {
  localStorage.setItem(KEY, name)
}
