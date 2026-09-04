import AddWordPanel from '@/components/AddWordPanel'
import AddLessonContentPanel from '@/components/AddLessonContentPanel'
import Layout from '@/components/Layout'
import NoteEditor from '@/components/NoteEditor'
import VideoControls from '@/components/VideoControls'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NoteList, ScreenshotList } from '@/components/StudyRoomLists'
import { notesDb, screenshotsDb, videosDb } from '@/integrations/turso/db'
import { extractVideoId } from '@/lib/youtube'
import { compressImageToDataUrl } from '@/lib/imageCompression'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookMarked, Copy, Eraser, Forward, ImagePlus, Layers, Loader2, Minus, Pause, Play, Plus, Rewind, StickyNote, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

const DRAW_COLORS = ['#FFD60A', '#FF3B30', '#00E5FF', '#FFFFFF', '#9BFF00', '#FF2D92']

const StudyRoom = () => {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const [apiReady, setApiReady] = useState(false)
  const [playerError, setPlayerError] = useState<number | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [noteOpen, setNoteOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const [addWordOpen, setAddWordOpen] = useState(false)
  const [addLessonOpen, setAddLessonOpen] = useState(false)
  const [panelSide, setPanelSide] = useState<'left' | 'right'>(() => {
    const saved = localStorage.getItem('studyroom-panel-side')
    return saved === 'left' ? 'left' : 'right'
  })

  useEffect(() => {
    localStorage.setItem('studyroom-panel-side', panelSide)
  }, [panelSide])

  // 0 means it conforms to the layout. Values > 0 represent raw vw (viewport width)
  const [outerWidth, setOuterWidth] = useState(0)

  // A-B Loop state
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Text-mode font size (12-28px, persisted)
  const [textSize, setTextSize] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('studyroom-text-size'))
      return saved >= 12 && saved <= 28 ? saved : 15
    } catch {
      return 15
    }
  })

  const changeTextSize = useCallback((delta: number) => {
    setTextSize((s) => {
      const next = Math.min(28, Math.max(12, s + delta))
      try {
        localStorage.setItem('studyroom-text-size', String(next))
      } catch {
        // storage unavailable — size just won't persist
      }
      return next
    })
  }, [])

  // Text selection -> "Add word" floating action
  const textContentRef = useRef<HTMLDivElement>(null)
  const selectionBtnRef = useRef<HTMLDivElement>(null)
  const [textSelection, setTextSelection] = useState<{ text: string; top: number; left: number } | null>(null)
  const [pendingWord, setPendingWord] = useState('')

  const readTextSelection = useCallback(() => {
    const container = textContentRef.current
    if (!container) {
      setTextSelection(null)
      return
    }
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ''
    const anchor = sel?.anchorNode
    const focus = sel?.focusNode
    if (
      !sel ||
      sel.isCollapsed ||
      !text ||
      !anchor ||
      !focus ||
      !container.contains(anchor) ||
      !container.contains(focus)
    ) {
      setTextSelection(null)
      return
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setTextSelection(null)
      return
    }
    const btnW = 128
    const btnH = 36
    const left = Math.min(Math.max(rect.left + rect.width / 2 - btnW / 2, 8), window.innerWidth - btnW - 8)
    const top = rect.top - btnH - 10 < 8 ? rect.bottom + 10 : rect.top - btnH - 10
    setTextSelection({ text, top, left })
  }, [])

  useEffect(() => {
    let raf = 0
    const onChange = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(readTextSelection)
    }
    document.addEventListener('selectionchange', onChange)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('selectionchange', onChange)
    }
  }, [readTextSelection])

  useEffect(() => {
    const dismiss = (e: MouseEvent) => {
      const target = e.target as Node
      if (selectionBtnRef.current?.contains(target)) return
      if (textContentRef.current && !textContentRef.current.contains(target)) {
        setTextSelection(null)
      }
    }
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [])

  // Drawing overlay state
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [strokeColor, setStrokeColor] = useState(DRAW_COLORS[0])
  const [isEraser, setIsEraser] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Array<{ color: string; eraser: boolean; points: Array<[number, number]> }>>([])
  const drawingRef = useRef({ active: false, lastX: 0, lastY: 0 })

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true)
      return
    }
    let existing = document.querySelector<HTMLScriptElement>('script[src*="iframe_api"]')
    if (!existing) {
      existing = document.createElement('script')
      existing.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(existing)
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      setApiReady(true)
      if (typeof prev === 'function') {
        try {
          prev()
        } catch {
          /* no-op */
        }
      }
    }
  }, [])

  const { data: video } = useQuery({
    queryKey: ['video', id],
    queryFn: () => videosDb.get(id!),
    enabled: !!id,
  })

  const videoId = video && video.youtube_url ? extractVideoId(video.youtube_url) : null

  const isText = video?.media_type === 'text'

  useEffect(() => {
    if (!videoId) {
      playerRef.current?.destroy()
      playerRef.current = null
      return
    }
    if (!apiReady || !videoId || !playerContainerRef.current) return
    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }
    setPlayerError(null)
    const host = playerContainerRef.current
    host.innerHTML = ''
    const mount = document.createElement('div')
    mount.style.width = '100%'
    mount.style.height = '100%'
    host.appendChild(mount)
    playerRef.current = new window.YT.Player(mount, {
      videoId,
      host: 'https://www.youtube-nocookie.com',
      playerVars: { modestbranding: 1, rel: 0, playsinline: 1 },
      onReady: () => setPlayerError(null),
      onError: (e: any) => setPlayerError(e?.data ?? -1),
      onStateChange: (e: any) => {
        if (e?.data === 1) setPlayerError(null)
        setIsPlaying(e?.data === 1)
      },
    })
  }, [apiReady, videoId, retryToken])

  useEffect(() => {
    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

  const getCurrentPlayerTime = useCallback((): number => {
    if (playerRef.current?.getCurrentTime) return Math.floor(playerRef.current.getCurrentTime())
    return 0
  }, [])

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo?.(seconds, true)
  }, [])

  const noopSeek = useCallback(() => {}, [])

  const openNotePanel = useCallback(() => {
    setCurrentTime(isText ? 0 : getCurrentPlayerTime())
    setNoteOpen(true)
    setAddWordOpen(false)
    setAddLessonOpen(false)
  }, [getCurrentPlayerTime, isText])

  const openAddWordPanel = useCallback(() => {
    setAddWordOpen(true)
    setNoteOpen(false)
    setAddLessonOpen(false)
  }, [])

  const openAddLessonPanel = useCallback(() => {
    setAddLessonOpen(true)
    setNoteOpen(false)
    setAddWordOpen(false)
  }, [])

  useEffect(() => {
    if (loopA !== null && loopB !== null) {
      loopIntervalRef.current = setInterval(() => {
        const t = getCurrentPlayerTime()
        if (t >= loopB) seekTo(loopA)
      }, 500)
    }
    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current)
    }
  }, [loopA, loopB, getCurrentPlayerTime, seekTo])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isInteractive =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'BUTTON' ||
        tag === 'SELECT' ||
        tag === 'A' ||
        target?.isContentEditable === true

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        openNotePanel()
        return
      }

      if (isText) return

      if (isInteractive) return

      if (e.code === 'Space') {
        e.preventDefault()
        const state = playerRef.current?.getPlayerState?.()
        if (state === 1) playerRef.current.pauseVideo()
        else playerRef.current?.playVideo?.()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        seekTo(Math.max(0, getCurrentPlayerTime() - 5))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        seekTo(getCurrentPlayerTime() + 5)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [getCurrentPlayerTime, seekTo, openNotePanel, isText])

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', id],
    queryFn: () => notesDb.listByVideo(id!),
    enabled: !!id,
  })

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      await notesDb.remove(noteId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', id] }),
  })

  const { data: screenshots = [] } = useQuery({
    queryKey: ['screenshots', id],
    queryFn: () => screenshotsDb.listByVideo(id!),
    enabled: !!id,
  })

  const uploadScreenshot = useMutation({
    mutationFn: async (file: File) => {
      const ts = isText ? 0 : getCurrentPlayerTime()
      const imageUrl = await compressImageToDataUrl(file)
      await screenshotsDb.insert({
        video_id: id!,
        timestamp: ts,
        image_url: imageUrl,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots', id] })
      toast.success('Screenshot uploaded')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteScreenshot = useMutation({
    mutationFn: async (ssId: string) => {
      await screenshotsDb.remove(ssId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['screenshots', id] }),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) uploadScreenshot.mutate(file)
      e.target.value = ''
    },
    [uploadScreenshot]
  )

  // Drawing overlay: full-viewport canvas sized to the window while Pen mode is open
  useEffect(() => {
    if (!isDrawingMode) return
    strokesRef.current = []
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const stroke of strokesRef.current) {
        ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over'
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.eraser ? 24 : 3
        ctx.beginPath()
        stroke.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    let resizeRAF: number | null = null
    const resize = () => {
      if (resizeRAF !== null) cancelAnimationFrame(resizeRAF)
      resizeRAF = requestAnimationFrame(() => {
        resizeRAF = null
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr))
        canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr))
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        redraw()
      })
    }

    resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      if (resizeRAF !== null) cancelAnimationFrame(resizeRAF)
      strokesRef.current = []
    }
  }, [isDrawingMode])

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = getCanvasPoint(e)
    drawingRef.current = { active: true, lastX: p.x, lastY: p.y }
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = isEraser ? '#ffffff' : strokeColor
    ctx.lineWidth = isEraser ? 24 : 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.01, p.y + 0.01)
    ctx.stroke()
    strokesRef.current.push({ color: isEraser ? '#ffffff' : strokeColor, eraser: isEraser, points: [[p.x, p.y]] })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.active) return
    e.preventDefault()
    const p = getCanvasPoint(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(drawingRef.current.lastX, drawingRef.current.lastY)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    strokesRef.current[strokesRef.current.length - 1].points.push([p.x, p.y])
    drawingRef.current.lastX = p.x
    drawingRef.current.lastY = p.y
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.active) return
    e.preventDefault()
    drawingRef.current.active = false
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const clearCanvas = () => {
    strokesRef.current = []
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Pen-mode video playback controls
  const togglePlay = useCallback(() => {
    const state = playerRef.current?.getPlayerState?.()
    if (state === 1) playerRef.current?.pauseVideo?.()
    else playerRef.current?.playVideo?.()
  }, [])

  const skipForward = useCallback(() => {
    seekTo(getCurrentPlayerTime() + 10)
  }, [getCurrentPlayerTime, seekTo])

  const rewind = useCallback(() => {
    seekTo(Math.max(0, getCurrentPlayerTime() - 10))
  }, [getCurrentPlayerTime, seekTo])

  // Width Controls
  const increaseOuterWidth = useCallback(
    () => setOuterWidth((w) => (w === 0 ? 80 : Math.min(98, w + 5))),
    []
  )
  const decreaseOuterWidth = useCallback(() => setOuterWidth((w) => (w <= 80 ? 0 : w - 5)), [])

  if (!video)
    return (
      <Layout>
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading…</p>
      </Layout>
    )

  return (
    <Layout>
      <div className="space-y-6 relative">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate pb-1">
          {video.title}
        </h1>

        {/* Main Layout: flex row */}
        <div className="flex flex-col lg:flex-row w-full gap-4 items-stretch lg:items-start">
          {/* Left Panel: Note Editor */}
          {panelSide === 'left' && noteOpen && (
            <NoteEditor
              videoId={id!}
              timestamp={currentTime}
              onClose={() => setNoteOpen(false)}
              position={panelSide}
              showTimestamp={!isText}
            />
          )}
          {panelSide === 'left' && addWordOpen && (
            <AddWordPanel
              defaultLanguage={video.language}
              onClose={() => setAddWordOpen(false)}
              position={panelSide}
              initialWord={pendingWord}
            />
          )}
          {panelSide === 'left' && addLessonOpen && (
            <AddLessonContentPanel
              defaultLanguage={video.language}
              onClose={() => setAddLessonOpen(false)}
              position={panelSide}
            />
          )}

          {/* Right Section: Video Player */}
          <div className="flex-1 min-w-0 flex flex-col md:flex-row gap-3 items-stretch md:items-start">
            {/* Action Buttons — beside the video */}
            <div className="flex flex-row md:flex-col gap-2 shrink-0 flex-wrap">
              <Button
                size="icon"
                variant="default"
                title="Add Note (Ctrl+Enter)"
                onClick={openNotePanel}>
                <StickyNote className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="default"
                title="Add Word"
                onClick={openAddWordPanel}>
                <BookMarked className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="default"
                title="Add Lesson Content"
                onClick={openAddLessonPanel}>
                <Layers className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                title="Screenshot"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadScreenshot.isPending}>
                {uploadScreenshot.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant={isDrawingMode ? 'default' : 'secondary'}
                title={isDrawingMode ? 'Close drawing overlay' : 'Pen / Draw'}
                onClick={() => setIsDrawingMode((v) => !v)}>
                <span className="font-mono font-bold text-sm leading-none">P</span>
              </Button>
              <div
                className="flex items-center gap-0.5 p-0.5 bg-muted/70 rounded-lg border border-border/50"
                title="Panels and pen controls open on this side">
                {(['left', 'right'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setPanelSide(side)}
                    className={`h-6 w-6 rounded-md text-[11px] font-bold transition-colors ${
                      panelSide === side
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}>
                    {side === 'left' ? 'L' : 'R'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {/* VIDEO CONTAINER: 
                When the side panel is CLOSED the player is centered and constrained
                (80% tablet, 70% desktop). When the panel is OPEN it expands to fill the
                remaining flex width (w-full) so the video stays large. The breakout Width
                controls override this with inline full-bleed styles when outerWidth > 0.
              */}
            <div
              className={`transition-all duration-300 ease-in-out space-y-4 z-10 ${
                noteOpen || addWordOpen || addLessonOpen ? 'w-full' : 'w-full md:w-[80%] lg:w-[70%] mx-auto'
              }`}
              style={
                outerWidth === 0
                  ? {}
                  : {
                      width: `${outerWidth}vw`,
                      marginLeft: `calc(-${outerWidth / 2}vw + 50%)`,
                      marginRight: `calc(-${outerWidth / 2}vw + 50%)`,
                      maxWidth: '100vw',
                    }
              }>
          {/* Player */}
          {isText ? (
            <div className="rounded-xl border border-primary/20 shadow-xl shadow-primary/5 overflow-hidden bg-card flex flex-col max-h-[75vh]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                  Text
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-0.5 bg-muted/70 rounded-lg border border-border/50 px-1 h-7"
                    title="Text size">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                      title="Smaller text"
                      onClick={() => changeTextSize(-1)}
                      disabled={textSize <= 12}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-[10px] font-mono w-6 text-center text-muted-foreground font-medium">
                      {textSize}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                      title="Larger text"
                      onClick={() => changeTextSize(1)}
                      disabled={textSize >= 28}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(video.content ?? '')
                        toast.success('Text copied')
                      } catch {
                        toast.error('Could not copy text')
                      }
                    }}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy text
                  </Button>
                </div>
              </div>
              <div ref={textContentRef} className="flex-1 overflow-y-auto p-6">
                {video.content ? (
                  <p
                    className="whitespace-pre-wrap leading-relaxed text-foreground/90 select-text"
                    style={{ fontSize: textSize }}>
                    {video.content}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">This text item is empty.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 shadow-xl shadow-primary/5 overflow-hidden bg-black aspect-video">
              <div className="w-full h-full relative">
                <div ref={playerContainerRef} className="w-full h-full" />

                {playerError !== null && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 text-white text-center p-6">
                    <p className="font-semibold text-sm sm:text-base">
                      This video can&apos;t play embedded (error {playerError}).
                    </p>
                    <p className="text-xs text-white/60 max-w-md">
                      It may not allow embedding, or your browser is blocking YouTube. Open it
                      directly instead.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="default"
                        onClick={() => video.youtube_url && window.open(video.youtube_url, '_blank', 'noopener')}
                        className="gap-2 text-xs">
                        Watch on YouTube
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setRetryToken((t) => t + 1)}
                        className="gap-2 text-xs text-white border-white/30 hover:bg-white/10">
                        Retry
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video Controls Bar */}
          {!isText && (
            <VideoControls
              playerRef={playerRef}
              loopA={loopA}
              loopB={loopB}
              onSetA={() => setLoopA(getCurrentPlayerTime())}
              onSetB={() => setLoopB(getCurrentPlayerTime())}
              onClearLoop={() => {
                setLoopA(null)
                setLoopB(null)
              }}
            />
          )}

          {/* Width Controls */}
          <div className="flex flex-wrap items-center gap-3 p-2 bg-card rounded-xl border border-border/50 shadow-sm">
            <div className="flex items-center gap-1 bg-background/80 rounded-lg border border-border/60 px-1 h-9 ml-auto shrink-0 shadow-inner">
              <span className="text-[10px] font-mono font-bold px-2 flex flex-col leading-none">
                <span className="text-muted-foreground font-medium text-[8px]">OVERALL</span>
                WIDTH
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                onClick={decreaseOuterWidth}
                disabled={outerWidth === 0}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-[10px] font-mono w-10 text-center text-muted-foreground font-medium">
                {outerWidth === 0 ? 'Auto' : `${outerWidth}vw`}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                onClick={increaseOuterWidth}
                disabled={outerWidth >= 98}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          </div>
        </div>

        {/* Right Panel: Note Editor */}
        {panelSide === 'right' && noteOpen && (
          <NoteEditor
            videoId={id!}
            timestamp={currentTime}
            onClose={() => setNoteOpen(false)}
            position={panelSide}
            showTimestamp={!isText}
          />
        )}
        {panelSide === 'right' && addWordOpen && (
          <AddWordPanel
            defaultLanguage={video.language}
            onClose={() => setAddWordOpen(false)}
            position={panelSide}
            initialWord={pendingWord}
          />
        )}
        {panelSide === 'right' && addLessonOpen && (
          <AddLessonContentPanel
            defaultLanguage={video.language}
            onClose={() => setAddLessonOpen(false)}
            position={panelSide}
          />
        )}
        </div>
        </div>

        {!isText && (
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground/80 font-mono mt-2 bg-muted/20 px-3 py-1.5 rounded-lg w-fit border border-border/30">
          <span className="flex items-center gap-1">
            <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/50 shadow-sm text-[9px] font-sans">
              Space
            </kbd>{' '}
            play/pause
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/50 shadow-sm text-[9px] font-sans">
              ←→
            </kbd>{' '}
            ±5s
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/50 shadow-sm text-[9px] font-sans">
              Ctrl+Enter
            </kbd>{' '}
            quick note
          </span>
        </div>
        )}

        {/* Notes & Screenshots Tabs */}
        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="bg-muted/40 border border-border/30 p-1 rounded-xl">
            <TabsTrigger
              value="notes"
              className="font-mono text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger
              value="screenshots"
              className="font-mono text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              Screenshots ({screenshots.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-6">
            <NoteList
              notes={notes}
              language={video.language}
              onSeek={isText ? noopSeek : seekTo}
              onDelete={deleteNote.mutate}
              showTimestamp={!isText}
            />
          </TabsContent>

          <TabsContent value="screenshots" className="mt-6">
            <ScreenshotList
              screenshots={screenshots}
              onSeek={isText ? noopSeek : seekTo}
              onDelete={deleteScreenshot.mutate}
              showTimestamp={!isText}
            />
          </TabsContent>
        </Tabs>
      </div>

      {isText && textSelection && (
        <div
          ref={selectionBtnRef}
          className="fixed z-[90] flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground shadow-lg px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
          style={{ top: textSelection.top, left: textSelection.left }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setPendingWord(textSelection.text)
            setTextSelection(null)
            window.getSelection()?.removeAllRanges()
            openAddWordPanel()
          }}>
          <BookMarked className="h-3.5 w-3.5" />
          Add word
        </div>
      )}

      {isDrawingMode && (
        <>
          <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[100] w-screen h-screen bg-transparent touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <div
            className={`fixed top-1/2 -translate-y-1/2 z-[110] flex flex-col items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 p-2 shadow-lg ${
              panelSide === 'right' ? 'right-0' : 'left-0'
            }`}>
          {/* Video playback controls */}
          <div className="flex flex-col gap-1.5 items-center">
            <Button
              size="icon"
              title="Rewind 10s"
              onClick={rewind}
              className="h-8 w-8 rounded-lg bg-white/10 text-white hover:bg-white/25 transition-colors">
              <Rewind className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              title={isPlaying ? 'Pause' : 'Play'}
              onClick={togglePlay}
              className={`h-9 w-9 rounded-lg transition-colors ${
                isPlaying
                  ? 'bg-white/10 text-white hover:bg-white/25'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              title="Skip Forward 10s"
              onClick={skipForward}
              className="h-8 w-8 rounded-lg bg-white/10 text-white hover:bg-white/25 transition-colors">
              <Forward className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-px w-full bg-white/15" />
          <div className="flex flex-col gap-1.5 items-center">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => {
                  setIsEraser(false)
                  setStrokeColor(c)
                }}
                className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  strokeColor === c && !isEraser
                    ? 'border-white scale-110'
                    : 'border-white/30'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="h-px w-full bg-white/15" />
          <Button
            size="icon"
            title="Eraser"
            onClick={() => setIsEraser((v) => !v)}
            className={`h-8 w-8 rounded-lg transition-colors ${
              isEraser
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-white/10 text-white hover:bg-white/25'
            }`}>
            <Eraser className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            title="Clear canvas"
            onClick={clearCanvas}
            className="h-8 w-8 rounded-lg bg-white/10 text-white hover:bg-white/25 transition-colors">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            title="Close overlay"
            onClick={() => setIsDrawingMode(false)}
            className="h-8 w-8 rounded-lg bg-white/10 text-white hover:bg-red-500/60 transition-colors">
            <X className="h-4 w-4" />
          </Button>
        </div>
        </>
      )}

      </Layout>
  )
}

export default StudyRoom
