import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Plus, Send, Sparkles, X } from 'lucide-react'

import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea'
import { Button } from '@/components/ui/button'
import { askTutor, type TutorContext, type TutorTurn } from '@/lib/aiChat'

interface TutorChatProps {
  context: TutorContext
  onClose?: () => void
  className?: string
  /** Called with an assistant answer when the learner chooses to keep it. */
  onAddToContext?: (text: string) => void
}

function suggestionsFor(context: TutorContext): string[] {
  if (context.word) {
    return ['Explain this word', 'Give two example sentences', 'Where does it come from?']
  }
  return ['What should I focus on?', 'Give me a practice sentence', 'Correct my sentence']
}

const TutorChat = ({ context, onClose, className, onAddToContext }: TutorChatProps) => {
  const [messages, setMessages] = useState<TutorTurn[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedAnswers, setAddedAnswers] = useState<Set<number>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = async (raw: string) => {
    const content = raw.trim()
    if (!content || pending) return
    const history: TutorTurn[] = [...messages, { role: 'user', content }]
    setMessages(history)
    setInput('')
    setPending(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller
    try {
      const reply = await askTutor(history, context, controller.signal)
      setMessages([...history, { role: 'assistant', content: reply }])
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'The AI tutor is unavailable right now.')
    } finally {
      setPending(false)
    }
  }

  const topic = context.word ? `“${context.word}”` : 'what you are studying'

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-primary/20 bg-card shadow-xl ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">AI Tutor</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono uppercase text-muted-foreground">
            {context.answerLanguage ?? 'English'}
          </span>
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="Close AI tutor"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        aria-live="polite"
        className="min-h-20 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ask about {topic}. Answers stay in {context.answerLanguage ?? 'English'}.
          </p>
        ) : null}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
              message.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.role === 'assistant' && onAddToContext ? (
              <button
                type="button"
                aria-label="Add this answer to the context note"
                disabled={addedAnswers.has(index)}
                onClick={() => {
                  onAddToContext(message.content)
                  setAddedAnswers((prev) => new Set(prev).add(index))
                }}
                className="mt-1.5 flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60">
                {addedAnswers.has(index) ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                {addedAnswers.has(index) ? 'Added' : 'Add to context'}
              </button>
            ) : null}
          </div>
        ))}
        {pending ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking…
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {suggestionsFor(context).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              onClick={() => send(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-end gap-1.5 border-t border-border/40 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}>
        <AutoGrowTextarea
          value={input}
          rows={1}
          placeholder="Ask the tutor…"
          aria-label="Message the AI tutor"
          className="min-h-8 bg-muted/30 text-xs focus-visible:ring-primary/30"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          className="h-8 w-8 shrink-0"
          disabled={!input.trim() || pending}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  )
}

export default TutorChat
