import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { TutorContext } from './aiChat'

/**
 * Pages and forms register the context they want the global Ask AI panel to
 * see. Registrations are merged in mount order, so a form opened on top of a
 * page (for example the word form on the video page) overrides the page's
 * title/transcript while keeping the fields the form does not set.
 */
export interface AiTutorRegistration {
  context: TutorContext
  /** Appends an assistant answer to the active form's note, when one is open. */
  onAddToContext?: (text: string) => void
}

export interface AiTutorSnapshot {
  context: TutorContext
  onAddToContext?: (text: string) => void
  open: boolean
}

const listeners = new Set<() => void>()
const registrations = new Map<number, AiTutorRegistration>()
let nextId = 1
let open = false
let snapshot: AiTutorSnapshot = { context: {}, open: false }

function cleanContext(context: TutorContext): TutorContext {
  const next: TutorContext = {}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' && value.trim()) {
      next[key as keyof TutorContext] = value.trim()
    }
  }
  return next
}

function recompute() {
  let context: TutorContext = {}
  let onAddToContext: ((text: string) => void) | undefined

  registrations.forEach((registration) => {
    context = { ...context, ...cleanContext(registration.context) }
    if (registration.onAddToContext) onAddToContext = registration.onAddToContext
  })

  snapshot = { context, onAddToContext, open }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => snapshot

/** The merged context, keep-answer callback, and open state of the global panel. */
export function useAiTutor(): AiTutorSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Registers context until the returned cleanup runs. */
export function registerAiTutor(registration: AiTutorRegistration): () => void {
  const id = nextId++
  registrations.set(id, registration)
  recompute()
  return () => {
    registrations.delete(id)
    recompute()
  }
}

/**
 * Registers a component's context while it is mounted and active. The callback
 * is read through a ref so a changing inline callback does not re-register on
 * every render.
 */
export function useRegisterAiTutor(registration: AiTutorRegistration, active = true) {
  const callbackRef = useRef(registration.onAddToContext)
  callbackRef.current = registration.onAddToContext
  const { word, translation, language, answerLanguage, note, transcript, title } =
    registration.context

  useEffect(() => {
    if (!active) return
    return registerAiTutor({
      context: { word, translation, language, answerLanguage, note, transcript, title },
      onAddToContext: callbackRef.current
        ? (text) => callbackRef.current?.(text)
        : undefined,
    })
  }, [active, word, translation, language, answerLanguage, note, transcript, title])
}

export function openAiTutor() {
  if (open) return
  open = true
  recompute()
}

export function closeAiTutor() {
  if (!open) return
  open = false
  recompute()
}

/** Test helper: clears the open state and every registration. */
export function resetAiTutor() {
  registrations.clear()
  open = false
  snapshot = { context: {}, open: false }
  listeners.forEach((listener) => listener())
}
