import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'

import AddWordPanel from '@/components/AddWordPanel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { displayAuthorName, getDownloadLinks, type GutendexBook } from '@/lib/gutendex'
import { extractBookBody, fetchBookText, isChapterHeading, splitIntoChapters } from '@/lib/bookReader'

interface BookReaderDialogProps {
  book: GutendexBook
  onClose: () => void
}

type Status = 'loading' | 'ready' | 'error' | 'none'

const BookReaderDialog = ({ book, onClose }: BookReaderDialogProps) => {
  const [status, setStatus] = useState<Status>('loading')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [page, setPage] = useState(0)
  const [pendingWord, setPendingWord] = useState('')
  const [vocabSession, setVocabSession] = useState(0)
  const [vocabOpen, setVocabOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const textUrl = getDownloadLinks(book).text

  useEffect(() => {
    if (!textUrl) {
      setStatus('none')
      return
    }
    let cancelled = false
    setStatus('loading')
    setError(null)
    setVocabOpen(false)
    fetchBookText(textUrl)
      .then((text) => {
        if (cancelled) return
        setBody(extractBookBody(text))
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not load the book text')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [textUrl, retryToken])

  const sections = useMemo(() => splitIntoChapters(body), [body])
  const current = sections[page]
  const sectionCount = sections.length

  useEffect(() => {
    setPage(0)
  }, [body])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0 })
      else el.scrollTop = 0
    }
    setVocabOpen(false)
  }, [page])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowLeft' && page > 0) setPage((p) => p - 1)
      if (e.key === 'ArrowRight' && page < sectionCount - 1) setPage((p) => p + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, sectionCount])

  // Double-clicking a word or dragging over a phrase leaves a selection in the reader;
  // hand it straight to the Add Word form, exactly like the study room.
  const handleMouseUp = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text) return
    setPendingWord(text)
    setVocabSession((s) => s + 1)
    setVocabOpen(true)
    window.getSelection()?.removeAllRanges()
  }

  const authors = book.authors.map((a) => displayAuthorName(a.name)).join(', ')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[85vh] max-w-6xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border/40 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="font-display text-xl font-semibold tracking-tight">
                {book.title}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">{authors}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={onClose}
              aria-label="Close reader">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {status === 'ready' && sectionCount > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {current?.title ? 'Chapter' : 'Part'} {page + 1} / {sectionCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === sectionCount - 1}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </DialogHeader>

        {status === 'loading' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading the book…</p>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={() => setRetryToken((v) => v + 1)}>
              Retry
            </Button>
          </div>
        ) : status === 'none' ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No readable text is available for this book.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
            <div
              ref={scrollRef}
              className="reader-scroll min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10"
              onMouseUp={handleMouseUp}>
              <div className="mx-auto max-w-prose font-serif text-[15px] leading-7 text-foreground/90">
                {current.title ? (
                  <p className="mb-8 mt-2 text-center text-lg font-semibold tracking-wide">
                    {current.title}
                  </p>
                ) : null}
                {current.text.split('\n').map((line, i) =>
                  isChapterHeading(line) ? (
                    <p
                      key={i}
                      className="mb-6 mt-10 text-center text-lg font-semibold tracking-wide">
                      {line.trim()}
                    </p>
                  ) : (
                    <p key={i} className={line.trim() ? 'min-h-[1.75rem]' : 'h-[1.75rem]'}>
                      {line}
                    </p>
                  )
                )}
              </div>
            </div>

            {vocabOpen ? (
              <div className="shrink-0 border-t border-border/40 p-4 lg:w-[26rem] lg:border-l lg:border-t-0">
                <AddWordPanel
                  key={vocabSession}
                  defaultLanguage="French"
                  position="right"
                  initialWord={pendingWord}
                  widthClassName="lg:w-full"
                  onClose={() => setVocabOpen(false)}
                />
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default BookReaderDialog