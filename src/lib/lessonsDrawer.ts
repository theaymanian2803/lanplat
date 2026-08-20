import { createContext, useContext } from 'react'

export const LessonsDrawerContext = createContext<() => void>(() => {})

export const useOpenLessonsDrawer = () => useContext(LessonsDrawerContext)