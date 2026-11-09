import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'

import TutorChat from '@/components/ai/TutorChat'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { closeAiTutor, useAiTutor } from '@/lib/aiTutor'
import type { TutorContext } from '@/lib/aiChat'

function contextSummary(context: TutorContext): string {
  if (context.word && context.language) return `About “${context.word}” · ${context.language}`
  if (context.word) return `About “${context.word}”`
  if (context.title && context.language) return `About ${context.title} · ${context.language}`
  if (context.title) return `About ${context.title}`
  return 'Ask about anything you are studying — a word, a sentence, or the material on screen.'
}

/**
 * The one Ask AI surface for the whole app. Pages register their context with
 * `useRegisterAiTutor`, so the panel always reads whatever form or material is
 * currently open.
 */
const AiTutorPanel = () => {
  const { open, context, onAddToContext } = useAiTutor()

  // The store outlives a page; close the panel when its Layout unmounts so a
  // route change does not reopen yesterday's conversation on a new page.
  useEffect(() => () => closeAiTutor(), [])

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closeAiTutor()}>
      <SheetContent
        side="right"
        overlayClassName="z-[100]"
        className="z-[100] flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="space-y-1.5 border-b border-border/40 px-5 py-4 pr-14 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <SheetTitle className="font-display text-lg tracking-[-0.02em]">Ask AI</SheetTitle>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              {context.answerLanguage ?? 'English'}
            </span>
          </div>
          <SheetDescription className="text-xs leading-relaxed text-muted-foreground">
            {contextSummary(context)}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 p-3">
          <TutorChat
            context={context}
            showHeader={false}
            onAddToContext={onAddToContext}
            className="h-full border-0 shadow-none"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default AiTutorPanel
