/**
 * Keeps an open tab on the current build.
 *
 * The PWA registers a Workbox service worker that precaches `index.html` and every hashed
 * asset. When a new deploy lands, the new worker installs, cleans the old precache, and
 * (because it calls `skipWaiting` + `clientsClaim`) takes control of tabs that are still
 * running the previous JavaScript. Those tabs then request chunk names that no longer exist.
 *
 * Reloading on `controllerchange` closes that window as soon as the update takes over.
 * The first install also fires the event, so only reload when the page already had a
 * controller when it loaded.
 */

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export function watchPwaUpdates(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  const checkForUpdate = () => {
    navigator.serviceWorker.ready
      .then((registration) => registration.update())
      .catch(() => {
        // Offline or a transient failure — the next check can try again.
      })
  }

  window.addEventListener('load', () => {
    checkForUpdate()
    window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
  })
}
