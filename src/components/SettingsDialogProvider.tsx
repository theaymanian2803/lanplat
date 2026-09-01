import { useCallback, useState, type ReactNode } from 'react'
import { SettingsDialogContext } from '@/lib/settingsDialog'
import { TursoSettingsDialog } from './TursoSettingsDialog'

export const SettingsDialogProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false)
  const openSettings = useCallback(() => setOpen(true), [])

  return (
    <SettingsDialogContext.Provider value={openSettings}>
      {children}
      <TursoSettingsDialog open={open} onOpenChange={setOpen} />
    </SettingsDialogContext.Provider>
  )
}

export default SettingsDialogProvider