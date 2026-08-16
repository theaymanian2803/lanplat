import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import AccessGate from '@/components/AccessGate'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const Index = lazy(() => import('./pages/Index'))
const StudyRoom = lazy(() => import('./pages/StudyRoom'))
const VocabBank = lazy(() => import('./pages/VocabBank'))
const FlashcardQuiz = lazy(() => import('./pages/FlashcardQuiz'))
const Languages = lazy(() => import('./pages/Languages'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AccessGate>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/video/:id" element={<StudyRoom />} />
              <Route path="/vocab" element={<VocabBank />} />
              <Route path="/quiz" element={<FlashcardQuiz />} />
              <Route path="/languages" element={<Languages />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AccessGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
