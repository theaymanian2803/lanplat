import { useEffect, useState } from 'react'

const COARSE_POINTER_QUERY = '(pointer: coarse)'

function detectCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia(COARSE_POINTER_QUERY).matches
    } catch {
      // Some embedded webviews throw on unsupported media features; fall back below.
    }
  }
  return typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0
}

/**
 * True on touch-first devices (phones, tablets). Used to keep actions that follow a
 * text selection away from the native selection menu, which a page cannot suppress.
 */
export function useCoarsePointer(): boolean {
  const [coarsePointer, setCoarsePointer] = useState(detectCoarsePointer)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    let query: MediaQueryList
    try {
      query = window.matchMedia(COARSE_POINTER_QUERY)
    } catch {
      return
    }
    const update = () => setCoarsePointer(detectCoarsePointer())
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  return coarsePointer
}
