import { beforeEach, describe, expect, it } from 'vitest'
import { ACCESS_STORAGE_KEY, isUnlocked, lock, unlock } from './access'

describe('access', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('uses the key the e2e spec seeds', () => {
    expect(ACCESS_STORAGE_KEY).toBe('lingovault_unlocked')
  })

  it('unlocks in sessionStorage, because that is the store the e2e spec seeds', () => {
    unlock()
    // Reading both stores pins which one the flag lives in. e2e/add-word.spec.ts seeds
    // sessionStorage, so a localStorage flag would lock that spec out of the app.
    expect(sessionStorage.getItem(ACCESS_STORAGE_KEY)).toBe('1')
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBeNull()
  })

  it('starts locked', () => {
    expect(isUnlocked()).toBe(false)
  })

  it('is locked when the stored flag is anything other than "1"', () => {
    sessionStorage.setItem(ACCESS_STORAGE_KEY, 'true')
    expect(isUnlocked()).toBe(false)
  })

  it('unlocks and reports unlocked', () => {
    unlock()
    expect(isUnlocked()).toBe(true)
  })

  it('locks again', () => {
    unlock()
    lock()
    expect(isUnlocked()).toBe(false)
  })
})
