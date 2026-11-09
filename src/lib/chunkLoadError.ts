/**
 * Recovery for stale-build chunk failures.
 *
 * Every production deploy gives the lazy route chunks new content-hashed names and removes
 * the previous files. A tab that is still running the old app shell (an old index.html, an
 * open tab across a deploy, or a service-worker precache from before the update) keeps
 * requesting the old chunk names. Those files no longer exist, so the dynamic import fails
 * with "Failed to fetch dynamically imported module".
 *
 * The only reliable recovery is to load the current shell again, which points at the new
 * chunk names. We do that automatically, but at most once per cooldown so a genuinely broken
 * deployment cannot trap the browser in a reload loop.
 */

export const CHUNK_RELOAD_KEY = 'lingovault.chunkReloadAt'
export const CHUNK_RELOAD_COOLDOWN_MS = 15_000

const CHUNK_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script|expected a javascript module script|loading chunk \S+ failed|unable to preload css/i

/** True when an error is the browser refusing to load a lazy (hashed) chunk. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return CHUNK_ERROR_PATTERN.test(message)
}

/**
 * Throttled decision for whether the page should reload. The timestamp is kept in
 * sessionStorage so the cooldown survives the reload itself.
 */
export function shouldReloadForChunkError(
  now: number = Date.now(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
): boolean {
  try {
    const raw = storage.getItem(CHUNK_RELOAD_KEY)
    if (raw !== null) {
      const last = Number(raw)
      if (Number.isFinite(last) && now - last < CHUNK_RELOAD_COOLDOWN_MS) return false
    }
    storage.setItem(CHUNK_RELOAD_KEY, String(now))
    return true
  } catch {
    // Storage can be blocked (private mode, embedded webviews). Prefer one reload over
    // leaving the user stuck on a dead shell.
    return true
  }
}

/** Reload to pick up the current build. Returns false when the cooldown blocks it. */
export function reloadForNewVersion(): boolean {
  if (!shouldReloadForChunkError()) return false
  window.location.reload()
  return true
}

/**
 * Vite fires `vite:preloadError` from its `__vitePreload` helper whenever a dynamic import
 * fails. Handling it centrally covers every lazy route, not just the page that happened to
 * be open when the deploy landed.
 */
export function installChunkLoadRecovery(): () => void {
  const handlePreloadError = () => {
    reloadForNewVersion()
  }

  window.addEventListener('vite:preloadError', handlePreloadError)

  return () => window.removeEventListener('vite:preloadError', handlePreloadError)
}
