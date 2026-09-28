import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'

import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppBootstrap from '@/components/AppBootstrap'
import ErrorBoundary from '@/components/ErrorBoundary'
import OnboardingDialog from '@/components/OnboardingDialog'
import RequireAccess from '@/components/RequireAccess'
import SettingsDialogProvider from '@/components/SettingsDialogProvider'
import { isOnboardingDone } from '@/lib/onboarding'

const Landing = lazy(() => import('./pages/Landing'))
const Index = lazy(() => import('./pages/Index'))
const StudyRoom = lazy(() => import('./pages/StudyRoom'))
const VocabBank = lazy(() => import('./pages/VocabBank'))
const FlashcardQuiz = lazy(() => import('./pages/FlashcardQuiz'))
const Languages = lazy(() => import('./pages/Languages'))
const LessonsPage = lazy(() => import('./pages/LessonsPage'))
const Translate = lazy(() => import('./pages/Translate'))
const Books = lazy(() => import('./pages/Books'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

const App = () => {
  const [onboardingOpen, setOnboardingOpen] = useState(() => !isOnboardingDone())

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route element={<RequireAccess />}>
                  <Route
                    element={
                      <>
                        <AppBootstrap />
                        <SettingsDialogProvider>
                          <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
                          <Outlet />
                        </SettingsDialogProvider>
                      </>
                    }>
                    <Route path="/dashboard" element={<Index />} />
                    <Route path="/vocab" element={<VocabBank />} />
                    <Route path="/quiz" element={<FlashcardQuiz />} />
                    <Route path="/lessons" element={<LessonsPage />} />
                    <Route path="/translate" element={<Translate />} />
                    <Route path="/books" element={<Books />} />
                    <Route path="/languages" element={<Languages />} />
                    <Route path="/video/:id" element={<StudyRoom />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
