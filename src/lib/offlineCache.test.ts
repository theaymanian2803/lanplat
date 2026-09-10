import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  cacheClear,
  cacheGet,
  cacheSet,
  clearSrsQueue,
  getSrsQueue,
  isOfflineError,
  queueSrsUpdate,
  withCache,
} from '@/lib/offlineCache'

describe('offlineCache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('round-trips data through the cache', () => {
    cacheSet('lessons', [{ id: 'l1' }])
    expect(cacheGet('lessons')).toEqual([{ id: 'l1' }])
    cacheClear('lessons')
    expect(cacheGet('lessons')).toBeNull()
  })

  it('returns null for missing or corrupted cache entries', () => {
    expect(cacheGet('missing')).toBeNull()
    localStorage.setItem('lingovault:cache:bad', 'not json')
    expect(cacheGet('bad')).toBeNull()
  })

  it('withCache stores fresh data and serves it when offline', async () => {
    const fetchFn = vi.fn().mockResolvedValue(['a', 'b'])
    expect(await withCache('vocab:all', fetchFn)).toEqual(['a', 'b'])
    expect(fetchFn).toHaveBeenCalledTimes(1)

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const failing = vi.fn().mockRejectedValue(new Error('fetch failed'))
    expect(await withCache('vocab:all', failing)).toEqual(['a', 'b'])
    expect(failing).toHaveBeenCalledTimes(1)
  })

  it('rethrows non-offline errors without serving stale data', async () => {
    cacheSet('vocab:all', ['stale'])
    const failing = vi.fn().mockRejectedValue(new Error('SQL error: no such table'))
    await expect(withCache('vocab:all', failing)).rejects.toThrow('SQL error')
  })

  it('recognizes offline-style errors', () => {
    expect(isOfflineError(new Error('fetch failed'))).toBe(true)
    expect(isOfflineError(new Error('Failed to fetch'))).toBe(true)
    expect(isOfflineError('NetworkError')).toBe(true)
    expect(isOfflineError(new Error('SQL error'))).toBe(false)
  })

  it('queues SRS updates last-write-wins per word', () => {
    queueSrsUpdate({ id: 'w1', mastery_level: 2, next_review_date: '2026-10-01' })
    queueSrsUpdate({ id: 'w2', mastery_level: 1, next_review_date: '2026-09-15' })
    queueSrsUpdate({ id: 'w1', mastery_level: 4, next_review_date: '2026-11-01' })
    expect(getSrsQueue()).toEqual([
      { id: 'w1', mastery_level: 4, next_review_date: '2026-11-01' },
      { id: 'w2', mastery_level: 1, next_review_date: '2026-09-15' },
    ])
    clearSrsQueue()
    expect(getSrsQueue()).toEqual([])
  })
})