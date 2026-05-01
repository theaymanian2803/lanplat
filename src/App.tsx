import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import FlashcardQuiz from './pages/FlashcardQuiz'
import Index from './pages/Index'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import StudyRoom from './pages/StudyRoom'
import VocabBank from './pages/VocabBank'
const queryClient = new QueryClient()

const ProtectedRoutes = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-mono text-sm animate-pulse">Loading…</p>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/video/:id" element={<StudyRoom />} />
      <Route path="/vocab" element={<VocabBank />} />
      <Route path="/quiz" element={<FlashcardQuiz />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <ProtectedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
