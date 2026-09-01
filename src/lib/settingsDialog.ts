import { createContext, useContext } from 'react'

export const SettingsDialogContext = createContext<() => void>(() => {})

export const useOpenSettingsDialog = () => useContext(SettingsDialogContext)