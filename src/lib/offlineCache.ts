const CACHE_PREFIX = 'lingovault:cache:'
const CACHE_VERSION = 'v1'
const SRS_QUEUE_KEY = 'lingovault:queue:srs'

export interface QueuedSrs {
  id: string
  mastery_level: number
  next_review_date: string
}

export function isOfflineError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = e instanceof Error ? e.message : String(e)
  return /fetch failed|failed to fetch|networkerror|network error|econnrefused|econnreset|socket hang up|timed? ?out|load failed|aborted/i.test(
    msg,
  )
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.v !== CACHE_VERSION) return null
    return parsed.data as T
  } catch {
    return null
  }
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ v: CACHE_VERSION, data }))
  } catch {
    // Quota exceeded or storage unavailable — offline fallback just won't have this key.
  }
}

export function cacheClear(key: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + key)
  } catch {
    // Ignore storage errors.
  }
}

export async function withCache<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  try {
    const data = await fetchFn()
    cacheSet(key, data)
    return data
  } catch (e) {
    if (isOfflineError(e)) {
      const cached = cacheGet<T>(key)
      if (cached !== null) return cached
    }
    throw e
  }
}

export function getSrsQueue(): QueuedSrs[] {
  try {
    const raw = localStorage.getItem(SRS_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function queueSrsUpdate(update: QueuedSrs): void {
  try {
    const queue = getSrsQueue()
    const existing = queue.findIndex((q) => q.id === update.id)
    if (existing >= 0) queue[existing] = update
    else queue.push(update)
    localStorage.setItem(SRS_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Storage unavailable — the grade is lost, but studying can continue.
  }
}

export function clearSrsQueue(): void {
  try {
    localStorage.removeItem(SRS_QUEUE_KEY)
  } catch {
    // Ignore storage errors.
  }
}