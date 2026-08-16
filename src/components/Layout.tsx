import { useCallback, useState, type ReactNode } from 'react'
import { Database, X } from 'lucide-react'
import Navbar from './Navbar'
import { TursoSettingsDialog } from './TursoSettingsDialog'
import { Button } from '@/components/ui/button'
import { dismissSetupBanner, shouldShowSetupBanner } from '@/lib/tursoConfig'

const Layout = ({ children }: { children: ReactNode }) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showBanner, setShowBanner] = useState(shouldShowSetupBanner())

  const handleDismissBanner = useCallback(() => {
    dismissSetupBanner()
    setShowBanner(false)
  }, [])

  const handleOpenSettings = useCallback(() => setSettingsOpen(true), [])

  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      <Navbar onOpenSettings={handleOpenSettings} />
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
              onClick={handleOpenSettings}
              className="shrink-0 font-mono text-xs"
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
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-20 py-6">{children}</main>
      <TursoSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

export default Layout
