import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookMarked, Captions, MoreHorizontal, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  cueContext,
  findActiveCueIndex,
  hasCachedTranscript,
  loadTranscript,
  toCaptionCode,
  type TranscriptCue,
} from '@/lib/youtubeTranscript'
import { formatTimestamp } from '@/lib/youtube'
import {
  getFloatingButtonPosition,
  getRangeText,
  getWordRangeAtPoint,
  isDoubleTap,
  type TextTap,
} from '@/lib/textSelection'
import type { YouTubePlayer } from '@/lib/youtubePlayer'

interface TranscriptStripProps {
  videoId: string
  language: string
  playerRef: React.MutableRefObject<YouTubePlayer | null>
  captureOpen: boolean
  /** Increments after a word is saved so the strip resumes following the player. */
  savedToken?: number
  onPause: () => void
  onSeekPause: (seconds: number) => void
  onWord: (word: string, context: string) => void
  controls: React.ReactNode
  /** Always-visible play / seek / CC controls, alongside the native YouTube chrome. */
  transportControls?: React.ReactNode
}

const TranscriptStrip = ({
  videoId,
  language,
  playerRef,
  captureOpen,
  savedToken = 0,
  onPause,
  onSeekPause,
  onWord,
  controls,
  transportControls,
}: TranscriptStripProps) => {
  const [code, setCode] = useState(() => toCaptionCode(language))

  useEffect(() => {
    setCode(toCaptionCode(language))
  }, [language])

  // Off by default. Keying the switch to the current video means opening a
  // different video starts off again, so no transcript request is ever sent
  // just because the Study Room rendered.
  const [enabledVideoId, setEnabledVideoId] = useState<string | null>(null)
  const enabled = enabledVideoId === videoId

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['transcript', videoId, code],
    queryFn: () => loadTranscript(videoId, code),
    enabled,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    // A retry would spend a second Supadata request on the same failure.
    // The Retry button below stays available for an explicit retry.
    retry: 0,
  })

  const cached = Boolean(data) || hasCachedTranscript(videoId, code)
  const cues = useMemo<TranscriptCue[]>(() => data?.cues ?? [], [data])

  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    // Keep ticking even while the vocab form is open; the form now stays open
    // after a save, so pausing the tick here would leave the strip stuck.
    if (!enabled) return
    const tick = () => {
      const value = playerRef.current?.getCurrentTime?.()
      if (typeof value === 'number') setSeconds(value)
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [enabled, playerRef])

  const activeIndex = useMemo(() => findActiveCueIndex(cues, seconds), [cues, seconds])

  const [frozen, setFrozen] = useState<number | null>(null)

  useEffect(() => {
    if (!captureOpen) setFrozen(null)
  }, [captureOpen])

  const shownIndex = frozen ?? activeIndex

  const [follow, setFollow] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!follow || frozen !== null) return
    const list = listRef.current
    if (!list) return
    const row = list.querySelector<HTMLElement>(`[data-cue-index="${activeIndex}"]`)
    if (!row) return
    const top = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2
    if (typeof list.scrollTo === 'function') {
      list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
  }, [activeIndex, follow, frozen])

  // A settled selection only shows the floating button. The vocab form opens
  // when the learner presses it, so a phrase can be dragged out first without
  // the form stealing focus mid-selection.
  const [pendingSelection, setPendingSelection] = useState<{
    word: string
    context: string
    top: number
    left: number
  } | null>(null)
  const pillRef = useRef<HTMLButtonElement>(null)

  const selectionTimerRef = useRef<number | undefined>(undefined)
  const lastTapRef = useRef<TextTap | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const cueIndexFor = useCallback(
    (node: Node | null): number => {
      const element =
        node?.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : (node?.parentElement ?? null)
      const host = element?.closest<HTMLElement>('[data-cue-index]')
      const index = host ? Number(host.dataset.cueIndex) : NaN
      return Number.isFinite(index) ? index : activeIndex
    },
    [activeIndex],
  )

  const clearSelectionTimer = useCallback(() => {
    if (selectionTimerRef.current !== undefined) {
      window.clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = undefined
    }
  }, [])

  // A saved word ends the capture for that cue. Slacken the frozen highlight so
  // the strip follows the player again while the form stays open.
  useEffect(() => {
    if (!savedToken) return
    setFrozen(null)
    setPendingSelection(null)
    setFollow(true)
    clearSelectionTimer()
  }, [clearSelectionTimer, savedToken])

  const readSelection = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ''
    if (
      !selection ||
      selection.isCollapsed ||
      !text ||
      !selection.anchorNode ||
      !selection.focusNode ||
      !list.contains(selection.anchorNode) ||
      !list.contains(selection.focusNode)
    ) {
      clearSelectionTimer()
      setPendingSelection(null)
      return
    }
    const index = cueIndexFor(selection.anchorNode)
    const cue = cues[index]
    if (!cue) return
    const range = selection.getRangeAt(0)
    const word = getRangeText(range) || text
    if (!word) return
    const context = cueContext(cue)
    clearSelectionTimer()
    selectionTimerRef.current = window.setTimeout(() => {
      selectionTimerRef.current = undefined
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      onPause()
      setFrozen(index)
      const { top, left } = getFloatingButtonPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        window.innerWidth,
      )
      setPendingSelection({ word, context, top, left })
    }, 300)
  }, [clearSelectionTimer, cueIndexFor, cues, onPause])

  useEffect(() => () => clearSelectionTimer(), [clearSelectionTimer])

  useEffect(() => {
    let frame = 0
    const onChange = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(readSelection)
    }
    document.addEventListener('selectionchange', onChange)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('selectionchange', onChange)
    }
  }, [readSelection])

  const addPendingToVocab = useCallback(() => {
    if (!pendingSelection) return
    const { word, context } = pendingSelection
    setPendingSelection(null)
    clearSelectionTimer()
    window.getSelection()?.removeAllRanges()
    onWord(word, context)
  }, [clearSelectionTimer, onWord, pendingSelection])

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (pillRef.current?.contains(event.target as Node)) return
      clearSelectionTimer()
      setPendingSelection(null)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [clearSelectionTimer])

  // A different video or caption track starts with no pending word.
  useEffect(() => {
    setPendingSelection(null)
  }, [enabled, videoId, code])

  const handleCueClick = useCallback(
    (index: number) => {
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed && selection.toString().trim()) return
      const cue = cues[index]
      if (!cue) return
      onSeekPause(cue.start)
      setFrozen(index)
    },
    [cues, onSeekPause],
  )

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }, [])

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const list = listRef.current
      const start = touchStartRef.current
      touchStartRef.current = null
      const touch = event.changedTouches[0]
      if (!list || !start || !touch) return
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) {
        lastTapRef.current = null
        return
      }
      const tap: TextTap = { time: Date.now(), x: touch.clientX, y: touch.clientY }
      const doubleTap = isDoubleTap(lastTapRef.current, tap)
      lastTapRef.current = doubleTap ? null : tap
      if (!doubleTap) return
      event.preventDefault()
      const word = getWordRangeAtPoint(list, touch.clientX, touch.clientY)
      if (!word) return
      const index = cueIndexFor(word.range.startContainer)
      const cue = cues[index]
      if (!cue) return
      const rect = word.range.getBoundingClientRect()
      window.getSelection()?.removeAllRanges()
      onPause()
      setFrozen(index)
      const { top, left } = getFloatingButtonPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        window.innerWidth,
      )
      setPendingSelection({ word: word.text, context: cueContext(cue), top, left })
    },
    [cueIndexFor, cues, onPause],
  )

  const rows = useMemo(
    () =>
      cues.map((cue, index) => {
        const active = index === shownIndex
        return (
          <div
            key={`${cue.start}-${index}`}
            role="button"
            tabIndex={0}
            data-cue-index={index}
            aria-current={active ? 'true' : undefined}
            onClick={() => handleCueClick(index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleCueClick(index)
              }
            }}
            className={`flex w-full cursor-pointer select-text gap-2 rounded-sm border-l-2 px-2 py-1 text-left text-sm leading-relaxed transition-colors ${
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <span
              className={`mt-0.5 w-10 shrink-0 select-none font-mono text-[10px] ${
                active ? 'text-primary' : 'text-muted-foreground/60'
              }`}
            >
              {formatTimestamp(Math.floor(cue.start))}
            </span>
            <span className="min-w-0 flex-1">{cue.text}</span>
          </div>
        )
      }),
    [cues, handleCueClick, shownIndex],
  )

  const shownCode = data?.languageCode || code

  return (
    <>
      <div className="rounded-xl border border-border/50 bg-card shadow-sm">
        <div
          className={`flex flex-wrap items-center gap-2 px-3 py-1.5 ${
            enabled ? 'border-b border-border/40' : ''
          }`}
        >
          <Captions className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="mono-label text-muted-foreground">Transcript</span>

          <div className="flex items-center gap-1.5">
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => setEnabledVideoId(checked ? videoId : null)}
              aria-label={enabled ? 'Turn transcript off' : 'Turn transcript on'}
              className="scale-75"
            />
            <span className="font-mono text-[10px] text-muted-foreground/70">
              {enabled ? 'on' : cached ? 'off · cached' : 'off · 1 request'}
            </span>
          </div>

          {transportControls ? (
            <div className="flex items-center gap-1">{transportControls}</div>
          ) : null}

          {data && data.tracks.length > 1 && (
            <Select value={shownCode} onValueChange={setCode}>
              <SelectTrigger className="h-6 w-[168px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.tracks.map((track) => (
                  <SelectItem key={track.code} value={track.code} className="text-xs">
                    {track.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {data?.isGenerated && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              auto
            </span>
          )}

          {isFetching && !isLoading && (
            <span className="font-mono text-[10px] text-muted-foreground/70">loading…</span>
          )}

          <div className="ml-auto flex items-center gap-1">
            {!follow && (
              <button
                type="button"
                onClick={() => setFollow(true)}
                className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary transition-colors hover:bg-primary/20"
              >
                Jump to current
              </button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  title="Playback options"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-3">
                {controls}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {enabled && (
          <div
            ref={listRef}
            className="relative h-[148px] overflow-y-auto px-1.5 py-1.5 touch-manipulation [-webkit-touch-callout:none]"
            onWheel={() => {
              setFollow(false)
              setPendingSelection(null)
            }}
            onTouchMove={() => {
              setFollow(false)
              setPendingSelection(null)
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(event) => {
              if (window.matchMedia?.('(pointer: coarse)').matches) event.preventDefault()
            }}
          >
            {isLoading && (
              <div className="space-y-2 p-2">
                {[0, 1, 2, 3].map((line) => (
                  <div
                    key={line}
                    className="h-3.5 animate-pulse rounded-sm bg-muted/60"
                    style={{ width: `${92 - line * 14}%` }}
                  />
                ))}
              </div>
            )}

            {!isLoading && isError && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-xs text-muted-foreground">
                  {error instanceof Error ? error.message : 'Could not load the transcript'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RotateCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            )}

            {!isLoading && !isError && cues.length === 0 && (
              <div className="flex h-full items-center justify-center px-4 text-center">
                <p className="text-xs text-muted-foreground">No captions for this video.</p>
              </div>
            )}

            {!isLoading && !isError && rows}
          </div>
        )}
      </div>

      {enabled && pendingSelection && (
        <button
          ref={pillRef}
          type="button"
          className="fixed z-[90] flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 touch-manipulation"
          style={{ top: pendingSelection.top, left: pendingSelection.left }}
          onMouseDown={(event) => event.preventDefault()}
          onTouchEnd={(event) => {
            event.preventDefault()
            addPendingToVocab()
          }}
          onClick={addPendingToVocab}
        >
          <BookMarked className="h-3.5 w-3.5" />
          Add to vocab
        </button>
      )}
    </>
  )
}

export default TranscriptStrip
