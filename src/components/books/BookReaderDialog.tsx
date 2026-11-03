import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { BookMarked, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'

import AddWordPanel from '@/components/AddWordPanel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { displayAuthorName, getDownloadLinks, type Book } from '@/lib/bookCatalog'
import { extractBookBody, fetchBookText, isChapterHeading, splitIntoChapters } from '@/lib/bookReader'
import {
  getFloatingButtonPosition,
  getLineStartButtonPosition,
  getWordRangeAtPoint,
  mergeWordRanges,
} from '@/lib/textSelection'
import { useCoarsePointer } from '@/hooks/useCoarsePointer'

interface BookReaderDialogProps {
  book: Book
  /** Display name of the language the book is written in, e.g. "French". */
  language: string
  onClose: () => void
}

type Status = 'loading' | 'ready' | 'error' | 'none'

interface TouchRect {
  top: number
  bottom: number
  left: number
  width: number
  height: number
}

interface TouchSelection {
  text: string
  anchor: Range
  rects: TouchRect[]
  isPhrase: boolean
  pillTop: number
  pillLeft: number
}

/** Match `getFloatingButtonPosition`'s defaults so clamping uses the same box as placement. */
const PILL_WIDTH = 128
const PILL_HEIGHT = 36

const BookReaderDialog = ({ book, language, onClose }: BookReaderDialogProps) => {
  const [status, setStatus] = useState<Status>('loading')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [page, setPage] = useState(0)
  const [pendingWord, setPendingWord] = useState('')
  const [vocabSession, setVocabSession] = useState(0)
  const [vocabOpen, setVocabOpen] = useState(false)
  const [textSelection, setTextSelection] = useState<{
    text: string
    top?: number
    left?: number
  } | null>(null)
  const [touchSelection, setTouchSelection] = useState<TouchSelection | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const coarsePointer = useCoarsePointer()
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const selectionBtnRef = useRef<HTMLButtonElement>(null)
  const vocabPanelRef = useRef<HTMLDivElement>(null)

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
    setTextSelection(null)
    setTouchSelection(null)
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

  // A settled selection shows a floating "Add to vocab" pill. The form only opens
  // when the learner presses it, so a phrase can be dragged out without being cut off.
  const readTextSelection = useCallback(() => {
    if (coarsePointer) return
    const container = scrollRef.current
    const sel = window.getSelection()
    if (!container || !sel || sel.isCollapsed) {
      setTextSelection(null)
      return
    }
    const anchor = sel.anchorNode
    const focus = sel.focusNode
    if (!anchor || !focus || !container.contains(anchor) || !container.contains(focus)) {
      setTextSelection(null)
      return
    }
    const text = sel.toString().replace(/\s+/g, ' ').trim()
    if (!text) {
      setTextSelection(null)
      return
    }
    let rect: DOMRect | null = null
    try {
      rect = sel.getRangeAt(0).getBoundingClientRect()
    } catch {
      rect = null
    }
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setTextSelection(null)
      return
    }
    // Keep the pill tied to text the reader can actually see. A selection scrolled
    // out of the reader, or a range that only touches the padding, gets no pill.
    const containerRect = container.getBoundingClientRect()
    const rangeRight = rect.left + rect.width
    const rangeBottom = rect.top + rect.height
    const visibleTop = Math.max(rect.top, containerRect.top)
    const visibleBottom = Math.min(rangeBottom, containerRect.bottom)
    const visibleLeft = Math.max(rect.left, containerRect.left)
    const visibleRight = Math.min(rangeRight, containerRect.right)
    if (visibleBottom <= visibleTop || visibleRight <= visibleLeft) {
      setTextSelection(null)
      return
    }

    const { top, left } = getFloatingButtonPosition(
      {
        top: visibleTop,
        bottom: visibleBottom,
        left: visibleLeft,
        width: visibleRight - visibleLeft,
      },
      window.innerWidth,
    )
    const contentRect = contentRef.current?.getBoundingClientRect()
    const offsetTop = contentRect?.top ?? 0
    const offsetLeft = contentRect?.left ?? 0
    // Absolute offsets inside DialogContent share the dialog's transformed space, so
    // the pill also has to stay inside the reader's visible band, not the viewport.
    const minTop = containerRect.top - offsetTop
    const maxTop = Math.max(minTop, containerRect.bottom - offsetTop - PILL_HEIGHT)
    const minLeft = containerRect.left - offsetLeft
    const maxLeft = Math.max(minLeft, containerRect.right - offsetLeft - PILL_WIDTH)
    const next = {
      text,
      top: Math.min(Math.max(top - offsetTop, minTop), maxTop),
      left: Math.min(Math.max(left - offsetLeft, minLeft), maxLeft),
    }
    setTextSelection((prev) =>
      prev && prev.text === next.text && prev.top === next.top && prev.left === next.left
        ? prev
        : next,
    )
  }, [coarsePointer])

  // Touch devices never create a native selection: the browser's copy menu would
  // cover the reader. A tap selects the word under the finger, and a second tap
  // extends that word to a phrase.
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0]
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }, [])

  const handleTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (!coarsePointer) return
      const container = scrollRef.current
      const content = contentRef.current
      const start = touchStartRef.current
      touchStartRef.current = null
      const touch = e.changedTouches[0]
      if (!container || !content || !start || !touch) return
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) return

      const word = getWordRangeAtPoint(container, touch.clientX, touch.clientY)
      if (!word) {
        setTouchSelection(null)
        return
      }

      let nextRange: Range
      let isPhrase = false
      if (!touchSelection || touchSelection.isPhrase) {
        nextRange = word.range
      } else {
        nextRange = mergeWordRanges(touchSelection.anchor, word.range)
        isPhrase = true
      }

      const text = nextRange.toString().replace(/\s+/g, ' ').trim()
      if (!text) {
        setTouchSelection(null)
        return
      }

      const contentRect = content.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const clientRects =
        typeof nextRange.getClientRects === 'function'
          ? Array.from(nextRange.getClientRects())
          : []
      const rects = clientRects
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({
          top: r.top - contentRect.top,
          bottom: r.bottom - contentRect.top,
          left: r.left - contentRect.left,
          width: r.width,
          height: r.height,
        }))
      if (rects.length === 0) {
        const fallback = word.range.getBoundingClientRect()
        rects.push({
          top: fallback.top - contentRect.top,
          bottom: fallback.bottom - contentRect.top,
          left: fallback.left - contentRect.left,
          width: fallback.width,
          height: fallback.height,
        })
      }

      const pill = getLineStartButtonPosition(rects, {
        top: containerRect.top - contentRect.top,
        left: containerRect.left - contentRect.left,
        width: containerRect.width,
        height: containerRect.height,
      })

      setTouchSelection({
        text,
        anchor: isPhrase ? touchSelection!.anchor : word.range.cloneRange(),
        rects,
        isPhrase,
        pillTop: pill.top,
        pillLeft: pill.left,
      })
      window.getSelection()?.removeAllRanges()
    },
    [coarsePointer, touchSelection],
  )

  const openVocabForSelection = useCallback(() => {
    const text = coarsePointer ? touchSelection?.text : textSelection?.text
    if (!text) return
    setPendingWord(text)
    setVocabSession((s) => s + 1)
    setVocabOpen(true)
    setTextSelection(null)
    setTouchSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [coarsePointer, textSelection, touchSelection])

  // On touch devices a long-press selection never fires mouseup (the browser
  // cancels the pointer), so watch selectionchange instead and debounce it.
  useEffect(() => {
    let timer: number | undefined
    const onSelectionChange = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(readTextSelection, 200)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      if (timer) window.clearTimeout(timer)
    }
  }, [readTextSelection])

  useEffect(() => {
    const dismiss = (e: PointerEvent) => {
      const target = e.target as Node
      if (selectionBtnRef.current?.contains(target)) return
      if (scrollRef.current && !scrollRef.current.contains(target)) {
        setTextSelection(null)
        setTouchSelection(null)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  // The pill unmounts on capture, so move the learner's focus into the form they just opened.
  useEffect(() => {
    if (!vocabOpen) return
    const timer = window.setTimeout(() => {
      vocabPanelRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [vocabOpen, vocabSession])

  const authors = book.authors.map((a) => displayAuthorName(a.name)).join(', ')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        className="flex h-[85vh] max-w-6xl flex-col gap-0 p-0">
        <div role="status" aria-live="polite" className="sr-only">
          {touchSelection || textSelection
            ? 'Phrase selected. Press Add to vocab to save it.'
            : ''}
        </div>
        {coarsePointer && touchSelection ? (
          <>
            {touchSelection.rects.map((rect, i) => (
              <div
                key={i}
                aria-hidden
                className="pointer-events-none absolute z-[55] rounded-sm bg-primary/20"
                style={{
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            ))}
            <button
              ref={selectionBtnRef}
              type="button"
              data-testid="reader-touch-pill"
              className="absolute z-[60] flex touch-manipulation items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
              style={{ top: touchSelection.pillTop, left: touchSelection.pillLeft }}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onTouchEnd={(e) => {
                e.preventDefault()
                openVocabForSelection()
              }}
              onClick={openVocabForSelection}>
              <BookMarked className="h-4 w-4" />
              Add to vocab
            </button>
          </>
        ) : !coarsePointer && textSelection ? (
          <button
            ref={selectionBtnRef}
            type="button"
            className="absolute z-[60] flex touch-manipulation items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
            style={{ top: textSelection.top, left: textSelection.left }}
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={(e) => {
              e.preventDefault()
              openVocabForSelection()
            }}
            onClick={openVocabForSelection}>
            <BookMarked className="h-3.5 w-3.5" />
            Add to vocab
          </button>
        ) : null}
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
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
            <div
              ref={scrollRef}
              className={`reader-scroll min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 ${
                coarsePointer ? 'select-none [-webkit-touch-callout:none]' : ''
              }`}
              onMouseUp={readTextSelection}
              onScroll={() => {
                if (coarsePointer) setTouchSelection(null)
                else if (textSelection) readTextSelection()
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => {
                if (coarsePointer) e.preventDefault()
              }}>
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
              <div
                ref={vocabPanelRef}
                className="flex h-[60%] min-h-0 shrink-0 flex-col overflow-hidden border-t border-border/40 p-3 lg:h-full lg:max-h-none lg:w-[26rem] lg:border-l lg:border-t-0 lg:p-4">
                <AddWordPanel
                  key={vocabSession}
                  defaultLanguage={language}
                  position="right"
                  initialWord={pendingWord}
                  widthClassName="h-full lg:w-full"
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