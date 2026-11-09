import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CHUNK_RELOAD_COOLDOWN_MS,
  CHUNK_RELOAD_KEY,
  installChunkLoadRecovery,
  isChunkLoadError,
  shouldReloadForChunkError,
} from '@/lib/chunkLoadError'

function memoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('isChunkLoadError', () => {
  it('recognises the browser messages for a missing lazy chunk', () => {
    const messages = [
      'Failed to fetch dynamically imported module: https://example.com/assets/VocabBank-CmAqBtWj.js',
      'error loading dynamically imported module: https://example.com/assets/VocabBank-CmAqBtWj.js',
      'Importing a module script failed.',
      'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".',
      'Loading chunk 12 failed.',
      'Unable to preload CSS for /assets/index-abc.css',
    ]

    for (const message of messages) {
      expect(isChunkLoadError(new Error(message))).toBe(true)
    }
  })

  it('ignores ordinary runtime errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError('network request failed')).toBe(false)
  })
})

describe('shouldReloadForChunkError', () => {
  it('allows the first reload and records when it happened', () => {
    const storage = memoryStorage()

    expect(shouldReloadForChunkError(1_000, storage)).toBe(true)
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe('1000')
  })

  it('blocks a second reload inside the cooldown', () => {
    const storage = memoryStorage()

    expect(shouldReloadForChunkError(1_000, storage)).toBe(true)
    expect(shouldReloadForChunkError(1_000 + CHUNK_RELOAD_COOLDOWN_MS - 1, storage)).toBe(false)
  })

  it('allows a reload again once the cooldown has passed', () => {
    const storage = memoryStorage()

    expect(shouldReloadForChunkError(1_000, storage)).toBe(true)
    expect(shouldReloadForChunkError(1_000 + CHUNK_RELOAD_COOLDOWN_MS, storage)).toBe(true)
  })

  it('allows a reload when session storage is unavailable', () => {
    const blocked = {
      getItem: () => {
        throw new Error('storage blocked')
      },
      setItem: () => {
        throw new Error('storage blocked')
      },
    }

    expect(shouldReloadForChunkError(1_000, blocked)).toBe(true)
  })
})

describe('installChunkLoadRecovery', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    sessionStorage.clear()
  })

  it('reloads once when Vite reports a failed preload, then respects the cooldown', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    })
    sessionStorage.clear()

    const uninstall = installChunkLoadRecovery()

    window.dispatchEvent(new Event('vite:preloadError'))
    window.dispatchEvent(new Event('vite:preloadError'))

    expect(reload).toHaveBeenCalledTimes(1)
    uninstall()
  })
})
