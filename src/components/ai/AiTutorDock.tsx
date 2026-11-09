import { useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { MessageCircle, Sparkles, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import TutorChat from '@/components/ai/TutorChat'
import { closeAiTutor, openAiTutor, useAiTutor } from '@/lib/aiTutor'
import type { TutorContext } from '@/lib/aiChat'

/** Human label for the route, used when no page registers a title. */
function routeLabel(pathname: string): string {
  if (pathname === '/') return 'Landing page'
  if (pathname.startsWith('/video/')) return 'Study Room'
  if (pathname.startsWith('/dashboard')) return 'Dashboard'
  if (pathname.startsWith('/vocab')) return 'Vocabulary Bank'
  if (pathname.startsWith('/quiz')) return 'Flashcards'
  if (pathname.startsWith('/lessons')) return 'Lessons'
  if (pathname.startsWith('/translate')) return 'Translate'
  if (pathname.startsWith('/books')) return 'Books'
  if (pathname.startsWith('/languages')) return 'Languages'
  return 'LingoVault'
}

function contextSummary(context: TutorContext): string {
  if (context.word && context.language) return `About “${context.word}” · ${context.language}`
  if (context.word) return `About “${context.word}”`
  if (context.title && context.language) return `About ${context.title} · ${context.language}`
  if (context.title) return `About ${context.title}`
  return 'Ask about anything you are studying — a word, a sentence, or the material on screen.'
}

/**
 * Website-style Ask AI widget: a fixed bubble on every route that opens a
 * non-blocking chat card. The page and any open form stay usable underneath.
 *
 * The card is a non-modal Radix dialog so it can layer above a page dialog
 * (Vocab Bank's add form, the book reader) without trapping focus or hiding
 * the rest of the page from assistive technology.
 */
const AiTutorDock = () => {
  const { open, context, onAddToContext } = useAiTutor()
  const location = useLocation()

  const effectiveContext: TutorContext = {
    ...context,
    title: context.title ?? routeLabel(location.pathname),
  }

  // Escape also reaches the non-modal dialog through Radix; this listener makes
  // the shortcut work when the page already owns focus outside the card.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAiTutor()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) closeAiTutor()
        }}
        modal={false}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed bottom-24 left-3 right-3 z-[100] flex h-[min(70dvh,600px)] flex-col overflow-hidden rounded-2xl border border-orange-400/40 bg-card shadow-2xl outline-none animate-in slide-in-from-bottom-4 sm:left-auto sm:right-6 sm:w-[400px]">
            <header className="flex items-start justify-between gap-2 border-b border-border/40 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-orange-500" />
                  <DialogPrimitive.Title className="font-display text-base tracking-[-0.02em]">
                    Ask AI
                  </DialogPrimitive.Title>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                    {context.answerLanguage ?? 'English'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {contextSummary(effectiveContext)}
                </p>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Close chat"
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </DialogPrimitive.Close>
            </header>

            <div className="min-h-0 flex-1 p-3">
              <TutorChat
                context={effectiveContext}
                showHeader={false}
                onAddToContext={onAddToContext}
                className="h-full border-0 shadow-none"
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <button
        type="button"
        aria-label={open ? 'Close Ask AI' : 'Ask AI'}
        aria-expanded={open}
        data-ai-dock
        onClick={open ? closeAiTutor : openAiTutor}
        className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">
        {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        <span className="hidden sm:inline">{open ? 'Close' : 'Ask AI'}</span>
      </button>
    </>
  )
}

export default AiTutorDock
