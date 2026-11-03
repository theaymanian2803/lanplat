import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useCoarsePointer } from '@/hooks/useCoarsePointer'

const originalMatchMedia = window.matchMedia
const originalTouchPoints = navigator.maxTouchPoints

const setPrimaryPointer = (coarse: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('pointer: coarse') ? coarse : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const setTouchPoints = (value: number) => {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value,
  })
}

describe('useCoarsePointer', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia
    setTouchPoints(originalTouchPoints)
  })

  it('is true when the primary pointer is coarse', () => {
    setPrimaryPointer(true)
    setTouchPoints(0)

    expect(renderHook(() => useCoarsePointer()).result.current).toBe(true)
  })

  it('stays false on a mouse-first touchscreen laptop', () => {
    setPrimaryPointer(false)
    setTouchPoints(5)

    expect(renderHook(() => useCoarsePointer()).result.current).toBe(false)
  })
})
