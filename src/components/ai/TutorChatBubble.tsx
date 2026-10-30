import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'

import TutorChat from '@/components/ai/TutorChat'
import type { TutorContext } from '@/lib/aiChat'

interface TutorChatBubbleProps {
  context?: TutorContext
}

/** Floating tutor chat for pages without their own inline chat surface. */
const TutorChatBubble = ({ context = {} }: TutorChatBubbleProps) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open ? (
        <div className="fixed bottom-20 right-4 z-[95] flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col">
          <TutorChat
            context={context}
            onClose={() => setOpen(false)}
            className="max-h-[70vh]"
          />
        </div>
      ) : null}
      <button
        type="button"
        aria-label={open ? 'Close AI tutor' : 'Ask the AI tutor'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 right-4 z-[96] flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary/90">
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </>
  )
}

export default TutorChatBubble
