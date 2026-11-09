import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { BookMarked, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'

import AddWordPanel from '@/components/AddWordPanel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { displayAuthorName, getDownloadLinks, type Book } from '@/lib/bookCatalog'
import { openAiTutor, useRegisterAiTutor } from '@/lib/aiTutor'
import {
  extractBookBody,
  fetchBookText,
  splitIntoChapters,
  splitIntoParagraphs,
} from '@/lib/bookReader'
import {
  getFloatingButtonPosition,
  getLineStartButtonPosition,
  getRangeText,
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
/** Hold this long on a word to start a drag selection on touch devices. */
const LONG_PRESS_MS = 320

/** A language's ink is identity, never a field: it colours the running-head dot only. */
const LANGUAGE_INK: Record<string, string> = {
  French: 'hsl(var(--tape))',
  Spanish: 'hsl(38 66% 44%)',
  Swedish: 'hsl(82 28% 38%)',
  Danish: 'hsl(var(--ink) / 0.45)',
}

const LANGUAGE_TAG: Record<string, string> = {
  French: 'fr',
  Spanish: 'es',
  Swedish: 'sv',
  Danish: 'da',
}

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
  const [progress, setProgress] = useState(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const touchSelectingRef = useRef(false)
  const touchAnchorRef = useRef<Range | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
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
  const blocks = useMemo(
    () => (current ? splitIntoParagraphs(current.text) : []),
    [current],
  )
  const ledeIndex = useMemo(
    () => blocks.findIndex((block) => block.kind === 'paragraph'),
    [blocks],
  )
  const dropCapIndex = useMemo(
    () =>
      blocks.findIndex(
        (block) =>
          block.kind === 'paragraph' &&
          block.text.length >= 180 &&
          /^[\p{L}\p{N}]/u.test(block.text),
      ),
    [blocks],
  )
  const proseLength = blocks.reduce(
    (total, block) => total + (block.kind === 'paragraph' ? block.text.length : 0),
    0,
  )

  // The open word form adds the selected word on top of this book context.
  useRegisterAiTutor({
    context: {
      title: book.title,
      language,
      transcript: current?.text ? current.text.slice(0, 3000) : undefined,
    },
  })

  useEffect(() => {
    setPage(0)
  }, [body])

  const updateProgress = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const next = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0
    setProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0 })
      else el.scrollTop = 0
    }
    setProgress(0)
    setVocabOpen(false)
    setTextSelection(null)
    setTouchSelection(null)
  }, [page])

  useEffect(() => {
    document.body.dataset.readerOpen = 'true'
    return () => {
      delete document.body.dataset.readerOpen
    }
  }, [])

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

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  /** Turn a range into the touch pill plus its highlight rectangles. */
  const presentTouchSelection = useCallback(
    (range: Range, anchor: Range, isPhrase: boolean) => {
      const container = scrollRef.current
      const content = contentRef.current
      if (!container || !content) return false

      const text = getRangeText(range)
      if (!text) return false

      const contentRect = content.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const clientRects =
        typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : []
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
        const fallback = range.getBoundingClientRect()
        rects.push({
          top: fallback.top - contentRect.top,
          bottom: fallback.bottom - contentRect.top,
          left: fallback.left - contentRect.left,
          width: fallback.width,
          height: fallback.height,
        })
      }

      const pill = getLineStartButtonPosition(
        rects,
        {
          top: containerRect.top - contentRect.top,
          left: containerRect.left - contentRect.left,
          width: containerRect.width,
          height: containerRect.height,
        },
        { width: 140, height: 40 },
      )

      setTouchSelection({
        text,
        anchor,
        rects,
        isPhrase,
        pillTop: pill.top,
        pillLeft: pill.left,
      })
      window.getSelection()?.removeAllRanges()
      return true
    },
    [],
  )

  const startTouchSelection = useCallback(
    (x: number, y: number) => {
      const container = scrollRef.current
      if (!container) return false
      const word = getWordRangeAtPoint(container, x, y)
      if (!word) return false
      const anchor = word.range.cloneRange()
      if (!presentTouchSelection(word.range, anchor, false)) return false
      touchSelectingRef.current = true
      touchAnchorRef.current = anchor
      return true
    },
    [presentTouchSelection],
  )

  // Touch devices never create a native selection: the browser's copy menu would
  // cover the reader. A tap selects a word and a second tap extends it; holding a
  // word starts a drag selection so a whole phrase or sentence can be swept out.
  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0]
      touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
      touchSelectingRef.current = false
      touchAnchorRef.current = null
      clearLongPress()
      if (!coarsePointer || !touch) return
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null
        const point = touchStartRef.current
        if (point) startTouchSelection(point.x, point.y)
      }, LONG_PRESS_MS)
    },
    [clearLongPress, coarsePointer, startTouchSelection],
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (touchSelectingRef.current) return
      const touch = e.touches[0]
      const start = touchStartRef.current
      if (!touch || !start) return
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) clearLongPress()
    },
    [clearLongPress],
  )

  const handleTouchCancel = useCallback(() => {
    clearLongPress()
    touchSelectingRef.current = false
    touchAnchorRef.current = null
    touchStartRef.current = null
  }, [clearLongPress])

  useEffect(() => () => clearLongPress(), [clearLongPress])

  // React's touch listeners are passive, so they cannot stop the reader from
  // scrolling while a drag selection is under the finger. Bind a non-passive
  // handler to the scroll container and only prevent scrolling once selecting.
  useEffect(() => {
    if (!coarsePointer || status !== 'ready') return
    const el = scrollRef.current
    if (!el) return
    const onMove = (e: globalThis.TouchEvent) => {
      if (!touchSelectingRef.current) return
      e.preventDefault()
      const touch = e.touches[0]
      const anchor = touchAnchorRef.current
      const container = scrollRef.current
      if (!touch || !anchor || !container) return
      const word = getWordRangeAtPoint(container, touch.clientX, touch.clientY)
      if (!word) return
      presentTouchSelection(mergeWordRanges(anchor, word.range), anchor, true)
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [coarsePointer, status, presentTouchSelection])

  const handleTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      clearLongPress()
      if (!coarsePointer) return
      if (touchSelectingRef.current) {
        touchSelectingRef.current = false
        touchAnchorRef.current = null
        return
      }
      const container = scrollRef.current
      const start = touchStartRef.current
      touchStartRef.current = null
      const touch = e.changedTouches[0]
      if (!container || !start || !touch) return
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) return

      const word = getWordRangeAtPoint(container, touch.clientX, touch.clientY)
      if (!word) {
        setTouchSelection(null)
        return
      }

      // caretRangeFromPoint snaps to the nearest text, so a tap in the padding or
      // a gutter would otherwise select a word the learner never touched.
      const wordRects =
        typeof word.range.getClientRects === 'function'
          ? Array.from(word.range.getClientRects())
          : []
      const wordRect = wordRects.find((r) => r.width > 0 && r.height > 0)
      const box = wordRect ?? word.range.getBoundingClientRect()
      const insideWord =
        touch.clientX >= box.left - 2 &&
        touch.clientX <= box.left + box.width + 2 &&
        touch.clientY >= box.top - 2 &&
        touch.clientY <= box.top + box.height + 2
      if (!insideWord) {
        setTouchSelection(null)
        return
      }

      if (!touchSelection || touchSelection.isPhrase) {
        presentTouchSelection(word.range, word.range.cloneRange(), false)
        return
      }

      presentTouchSelection(
        mergeWordRanges(touchSelection.anchor, word.range),
        touchSelection.anchor,
        true,
      )
    },
    [clearLongPress, coarsePointer, presentTouchSelection, touchSelection],
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
  const errorMessage = error
    ? /failed to fetch|networkerror|load failed/i.test(error)
      ? 'Could not reach the text archive. Check your connection and try again.'
      : error
    : null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        className="reader-sheet fixed flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:rounded-none"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}>
        {status === 'ready' ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[62] h-0.5 bg-ink/20">
            <div
              className="h-full bg-ink/60 transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : null}
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
            <div
              data-testid="reader-touch-bar"
              className="absolute inset-x-0 bottom-11 z-[60] flex justify-center border-t border-ink/15 bg-enamel px-4 py-3"
              onPointerDown={(e) => e.stopPropagation()}>
              <button
                ref={selectionBtnRef}
                type="button"
                data-testid="reader-touch-pill"
                className="flex min-h-11 touch-manipulation items-center gap-1.5 rounded-sm bg-primary px-4 text-sm font-semibold text-black transition-colors hover:bg-primary/90"
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
            </div>
          </>
        ) : !coarsePointer && textSelection ? (
          <button
            ref={selectionBtnRef}
            type="button"
            className="absolute z-[60] flex touch-manipulation items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-black ring-2 ring-enamel transition-colors hover:bg-primary/90"
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
        <DialogHeader className="shrink-0 space-y-0 border-b border-ink/15 px-5 pb-3 pt-4 md:px-10 lg:px-14">
          <div className="mx-auto flex w-full max-w-[84rem] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: LANGUAGE_INK[language] ?? 'hsl(var(--ink) / 0.45)' }}
              />
              <DialogTitle className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
                {book.title}
              </DialogTitle>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-sm text-ink/50 md:h-8 md:w-8 hover:bg-ink/10 hover:text-ink"
                onClick={openAiTutor}
                aria-label="Ask AI about this book">
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-sm text-ink/50 md:h-8 md:w-8 hover:bg-ink/10 hover:text-ink"
                onClick={onClose}
                aria-label="Close reader">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {status === 'loading' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="h-px w-28 overflow-hidden bg-ink/15">
              <div className="h-full w-1/2 animate-pulse bg-ink/45" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/65">
              Fetching the text
            </p>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div aria-hidden className="h-px w-16 bg-ink/25" />
            <p className="max-w-sm font-reading text-base leading-relaxed text-ink/75" role="alert">
              {errorMessage}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-sm border-ink/25 bg-transparent text-ink hover:bg-ink/5 hover:text-ink"
              onClick={() => setRetryToken((v) => v + 1)}>
              Retry
            </Button>
          </div>
        ) : status === 'none' ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="max-w-sm font-reading text-base leading-relaxed text-ink/70">
              No readable text is available for this book.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            <div
              ref={scrollRef}
              className={`reader-scroll reader-sheet-scroll min-h-0 min-w-0 flex-1 overflow-y-auto ${
                coarsePointer ? 'select-none touch-manipulation [-webkit-touch-callout:none]' : ''
              }`}
              onMouseUp={readTextSelection}
              onScroll={() => {
                updateProgress()
                if (coarsePointer) {
                  clearLongPress()
                  touchSelectingRef.current = false
                  touchAnchorRef.current = null
                  setTouchSelection(null)
                } else if (textSelection) {
                  readTextSelection()
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
              onContextMenu={(e) => {
                if (coarsePointer) e.preventDefault()
              }}>
              <article
                lang={LANGUAGE_TAG[language]}
                className="reader-prose mx-auto w-full max-w-[68ch] px-6 pb-16 pt-9 md:px-8 md:pt-12">
                {current.title ? (
                  <header className="mb-9 md:mb-12">
                    <h2 className="font-display text-[clamp(1.85rem,3.6vw,2.9rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-ink">
                      {current.title}
                    </h2>
                    <div aria-hidden className="mt-5 h-px w-14 bg-ink/35" />
                    {page === 0 && authors ? (
                      <p className="mt-4 font-reading text-sm italic text-ink/65">{authors}</p>
                    ) : null}
                  </header>
                ) : null}
                <div className="font-reading text-[1.1875rem] leading-[1.78] text-ink/90">
                  {blocks.map((block, index) =>
                    block.kind === 'heading' ? (
                      <h3
                        key={index}
                        className="mb-5 mt-10 font-display text-base font-bold uppercase tracking-[0.16em] text-ink md:text-lg">
                        {block.text}
                      </h3>
                    ) : (
                      <p
                        key={index}
                        data-dropcap={index === dropCapIndex ? 'true' : undefined}
                        className={
                          index === ledeIndex || index === dropCapIndex ? 'reader-lede' : undefined
                        }>
                        {block.text}
                      </p>
                    ),
                  )}
                </div>
                {proseLength > 600 ? (
                  <div aria-hidden className="mt-14 flex items-center justify-center gap-3">
                    <span className="h-px w-12 bg-ink/20" />
                    <span className="h-1 w-1 rotate-45 bg-ink/30" />
                    <span className="h-px w-12 bg-ink/20" />
                  </div>
                ) : null}
              </article>
            </div>

            {vocabOpen ? (
              <div
                ref={vocabPanelRef}
                className="flex h-[58%] min-h-0 shrink-0 flex-col overflow-hidden border-t border-ink/15 bg-[hsl(44_28%_85%)] px-5 py-5 md:px-8 lg:h-auto lg:w-[22rem] lg:border-l lg:border-t-0 lg:px-7 lg:py-7">
                <AddWordPanel
                  key={vocabSession}
                  tone="paper"
                  defaultLanguage={language}
                  position="right"
                  initialWord={pendingWord}
                  widthClassName="mx-auto w-full max-w-xl lg:max-w-none"
                  onClose={() => setVocabOpen(false)}
                />
              </div>
            ) : null}
          </div>
        )}

        {status === 'ready' ? (
          <footer className="shrink-0 border-t border-ink/15 px-3 py-0 md:px-10 lg:px-14">
            <div className="mx-auto flex w-full max-w-[84rem] items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="flex min-h-11 items-center gap-1.5 rounded-sm px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65 transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30">
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="font-mono text-[11px] tracking-[0.16em] text-ink/65">
                {page + 1} / {sectionCount || 1}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === sectionCount - 1}
                className="flex min-h-11 items-center gap-1.5 rounded-sm px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65 transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30">
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </footer>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export default BookReaderDialog