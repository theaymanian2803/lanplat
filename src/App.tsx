import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import AccessGate from '@/components/AccessGate'
import ErrorBoundary from '@/components/ErrorBoundary'
import OnboardingDialog from '@/components/OnboardingDialog'
import SettingsDialogProvider from '@/components/SettingsDialogProvider'
import { isOnboardingDone } from '@/lib/onboarding'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const Index = lazy(() => import('./pages/Index'))
const StudyRoom = lazy(() => import('./pages/StudyRoom'))
const VocabBank = lazy(() => import('./pages/VocabBank'))
const FlashcardQuiz = lazy(() => import('./pages/FlashcardQuiz'))
const Languages = lazy(() => import('./pages/Languages'))
const LessonsPage = lazy(() => import('./pages/LessonsPage'))
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
          <AccessGate>
            <SettingsDialogProvider>
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/video/:id" element={<StudyRoom />} />
                    <Route path="/vocab" element={<VocabBank />} />
                    <Route path="/quiz" element={<FlashcardQuiz />} />
                    <Route path="/languages" element={<Languages />} />
                    <Route path="/lessons" element={<LessonsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
              <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
            </SettingsDialogProvider>
          </AccessGate>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
