/**
 * Single home for the unlock flag.
 *
 * The key name and the sessionStorage store are load bearing: e2e/add-word.spec.ts seeds
 * `sessionStorage.setItem('lingovault_unlocked', '1')` to bypass the gate in tests, so
 * neither may be renamed or moved to localStorage.
 */
export const ACCESS_STORAGE_KEY = 'lingovault_unlocked'

export const isUnlocked = (): boolean => sessionStorage.getItem(ACCESS_STORAGE_KEY) === '1'

export const unlock = (): void => {
  sessionStorage.setItem(ACCESS_STORAGE_KEY, '1')
}

export const lock = (): void => {
  sessionStorage.removeItem(ACCESS_STORAGE_KEY)
}
