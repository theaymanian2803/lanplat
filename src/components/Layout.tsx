import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Database, WifiOff, X } from 'lucide-react'
import Navbar from './Navbar'
import LessonsPanel from './LessonsPanel'
import { LessonsDrawerContext } from '@/lib/lessonsDrawer'
import { useOpenSettingsDialog } from '@/lib/settingsDialog'
import { ACCESS_STORAGE_KEY } from './AccessGate'
import { Button } from '@/components/ui/button'
import { flushSrsQueue } from '@/integrations/turso/db'
import { dismissSetupBanner, shouldShowSetupBanner } from '@/lib/tursoConfig'

const Layout = ({ children }: { children: ReactNode }) => {
  const openSettings = useOpenSettingsDialog()
  const [lessonsOpen, setLessonsOpen] = useState(false)
  const [showBanner, setShowBanner] = useState(shouldShowSetupBanner())
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => {
      setOffline(false)
      flushSrsQueue()
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  const handleDismissBanner = useCallback(() => {
    dismissSetupBanner()
    setShowBanner(false)
  }, [])

  const handleToggleLessons = useCallback(() => setLessonsOpen((v) => !v), [])
  const handleOpenLessons = useCallback(() => setLessonsOpen(true), [])

  const handleSignOut = useCallback(() => {
    sessionStorage.removeItem(ACCESS_STORAGE_KEY)
    window.location.reload()
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      <Navbar
        onOpenSettings={openSettings}
        onSignOut={handleSignOut}
        lessonsOpen={lessonsOpen}
        onToggleLessons={handleToggleLessons}
      />
      {showBanner && (
        <div className="border-b border-border bg-muted/40 px-4 sm:px-6 lg:px-20 py-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="flex-1">
              This site is running on a shared demo database. Connect your own database to keep your
              data private.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={openSettings}
              className="shrink-0 font-mono text-xs"
              data-tour="connect-button"
            >
              Connect
            </Button>
            <button
              onClick={handleDismissBanner}
              aria-label="Dismiss"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      {/* w-full with no max-width constraint allows it to take the entire screen */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-20 py-6">
        <LessonsDrawerContext.Provider value={handleOpenLessons}>
          {children}
        </LessonsDrawerContext.Provider>
      </main>
      <LessonsPanel open={lessonsOpen} onOpenChange={setLessonsOpen} />
      {offline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-mono text-muted-foreground shadow-lg">
          <WifiOff className="h-3.5 w-3.5 text-amber-400" />
          Offline — showing saved data
        </div>
      )}
    </div>
  )
}

export default Layout
