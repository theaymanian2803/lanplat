import { beforeEach, describe, expect, it } from 'vitest'
import { ACCESS_STORAGE_KEY, isUnlocked, lock, unlock } from './access'

describe('access', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('uses the key the e2e spec seeds', () => {
    expect(ACCESS_STORAGE_KEY).toBe('lingovault_unlocked')
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
