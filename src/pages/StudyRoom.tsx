import Layout from '@/components/Layout'
import VideoControls from '@/components/VideoControls'
import Whiteboard from '@/components/Whiteboard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { openDictionary } from '@/lib/dictionary'
import { extractVideoId, formatTimestamp } from '@/lib/youtube'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ImagePlus, Minus, PenTool, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

const StudyRoom = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const noteInputRef = useRef<HTMLInputElement>(null)
  const [apiReady, setApiReady] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [currentTime, setCurrentTime] = useState(0)

  const [whiteboardOpen, setWhiteboardOpen] = useState(false)
  const [whiteboardHeight, setWhiteboardHeight] = useState(50) // vh units

  // 0 means it conforms to the layout. Values > 0 represent raw vw (viewport width)
  const [outerWidth, setOuterWidth] = useState(0)

  // A-B Loop state
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true)
      return
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = () => setApiReady(true)
  }, [])

  const { data: video } = useQuery({
    queryKey: ['video', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('videos').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const videoId = video ? extractVideoId(video.youtube_url) : null

  useEffect(() => {
    if (!apiReady || !videoId || !playerContainerRef.current) return
    if (playerRef.current) playerRef.current.destroy()
    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      videoId,
      playerVars: { modestbranding: 1, rel: 0 },
    })
  }, [apiReady, videoId])

  const getCurrentPlayerTime = useCallback((): number => {
    if (playerRef.current?.getCurrentTime) return Math.floor(playerRef.current.getCurrentTime())
    return 0
  }, [])

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo?.(seconds, true)
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
      const tag = (e.target as HTMLElement)?.tagName
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setCurrentTime(getCurrentPlayerTime())
        setNoteDialogOpen(true)
        setTimeout(() => noteInputRef.current?.focus(), 100)
        return
      }

      if (isInput) return

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
  }, [getCurrentPlayerTime, seekTo])

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('video_id', id!)
        .order('timestamp', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notes').insert({
        video_id: id!,
        user_id: user!.id,
        timestamp: currentTime,
        content: noteContent,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', id] })
      setNoteDialogOpen(false)
      setNoteContent('')
      toast.success('Note added')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', noteId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', id] }),
  })

  const { data: screenshots = [] } = useQuery({
    queryKey: ['screenshots', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screenshots')
        .select('*')
        .eq('video_id', id!)
        .order('timestamp', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const uploadScreenshot = useMutation({
    mutationFn: async (file: File) => {
      const ts = getCurrentPlayerTime()
      const ext = file.name.split('.').pop()
      const path = `${user!.id}/${id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('screenshots').upload(path, file)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(path)
      const { error } = await supabase.from('screenshots').insert({
        video_id: id!,
        user_id: user!.id,
        timestamp: ts,
        image_url: urlData.publicUrl,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots', id] })
      toast.success('Screenshot uploaded')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteScreenshot = useMutation({
    mutationFn: async (ssId: string) => {
      const { error } = await supabase.from('screenshots').delete().eq('id', ssId)
      if (error) throw error
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
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-blue-500 bg-clip-text text-transparent truncate pb-1">
          {video.title}
        </h1>

        {/* ROBUST FULL-BLEED WRAPPER: 
          This uses negative margins to cleanly break out of max-width containers 
          without breaking standard layout flow or causing weird horizontal scroll clipping.
        */}
        <div
          className="transition-all duration-300 ease-in-out space-y-4 z-10"
          style={{
            width: outerWidth === 0 ? '100%' : `${outerWidth}vw`,
            marginLeft: outerWidth === 0 ? '0' : `calc(-${outerWidth / 2}vw + 50%)`,
            marginRight: outerWidth === 0 ? '0' : `calc(-${outerWidth / 2}vw + 50%)`,
            maxWidth: '100vw',
          }}>
          {/* Player + Whiteboard */}
          <ResizablePanelGroup
            direction="horizontal"
            className={`rounded-xl border border-primary/20 shadow-xl shadow-primary/5 overflow-hidden bg-background ${!whiteboardOpen ? 'aspect-video' : ''}`}
            style={{ height: whiteboardOpen ? `${whiteboardHeight}vh` : 'auto' }}>
            {whiteboardOpen && (
              <>
                <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
                  <Whiteboard
                    onClose={() => setWhiteboardOpen(false)}
                    height={whiteboardHeight}
                    onHeightChange={setWhiteboardHeight}
                  />
                </ResizablePanel>
                <ResizableHandle
                  withHandle
                  className="bg-primary/20 hover:bg-primary/40 transition-colors"
                />
              </>
            )}
            <ResizablePanel defaultSize={whiteboardOpen ? 50 : 100} minSize={20} maxSize={100}>
              <div className="w-full h-full bg-black overflow-hidden relative">
                <div ref={playerContainerRef} className="w-full h-full" />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* Video Controls Bar */}
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

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 p-2 bg-card rounded-xl border border-border/50 shadow-sm">
            <Button
              onClick={() => {
                setCurrentTime(getCurrentPlayerTime())
                setNoteDialogOpen(true)
              }}
              className="gap-2 font-mono text-xs bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-md hover:shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <StickyNote className="h-4 w-4" />
              Add Note
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 font-mono text-xs shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={uploadScreenshot.isPending}>
              <ImagePlus className="h-4 w-4" />
              {uploadScreenshot.isPending ? 'Uploading…' : 'Screenshot'}
            </Button>
            <Button
              variant={whiteboardOpen ? 'default' : 'secondary'}
              onClick={() => setWhiteboardOpen((v) => !v)}
              className="gap-2 font-mono text-xs shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
              <PenTool className="h-4 w-4" />
              {whiteboardOpen ? 'Close Board' : 'Whiteboard'}
            </Button>

            {/* Breakout Width Controls */}
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

          <TabsContent value="notes" className="space-y-3 mt-6">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border/50 rounded-xl bg-card/30">
                <StickyNote className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm font-medium">No notes yet.</p>
                <p className="text-muted-foreground/70 text-xs mt-1">
                  Press Ctrl+Enter to take a quick note while watching.
                </p>
              </div>
            ) : (
              notes.map((n) => (
                <Card
                  key={n.id}
                  className="p-4 flex items-start gap-3 border-border/40 bg-card hover:border-primary/30 hover:shadow-md transition-all group rounded-xl">
                  <Badge
                    variant="outline"
                    className="cursor-pointer font-mono text-[11px] shrink-0 bg-primary/5 text-primary border-primary/20 hover:bg-primary/20 transition-colors shadow-sm"
                    onClick={() => seekTo(n.timestamp)}>
                    {formatTimestamp(n.timestamp)}
                  </Badge>
                  <p className="text-sm flex-1 min-w-0 leading-relaxed text-foreground/90">
                    {n.content}
                  </p>
                  <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                      title="Look up in dictionary"
                      onClick={() => openDictionary(n.content.split(/\s+/)[0], video.language)}>
                      <BookOpen className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                      onClick={() => deleteNote.mutate(n.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="screenshots" className="mt-6">
            {screenshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border/50 rounded-xl bg-card/30">
                <ImagePlus className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm font-medium">No screenshots yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {screenshots.map((s) => (
                  <div
                    key={s.id}
                    className="group relative rounded-xl overflow-hidden border border-border/40 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300">
                    <img
                      src={s.image_url}
                      alt=""
                      className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
                      <div className="flex items-end justify-between pointer-events-auto">
                        <Badge
                          variant="outline"
                          className="cursor-pointer font-mono text-[10px] bg-black/60 backdrop-blur-md border-white/20 text-white hover:bg-white/20 hover:border-white/40 transition-all shadow-sm"
                          onClick={() => seekTo(s.timestamp)}>
                          {formatTimestamp(s.timestamp)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 bg-black/40 backdrop-blur-md text-white/80 hover:text-red-400 hover:bg-red-500/20 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
                          onClick={() => deleteScreenshot.mutate(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md border-primary/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              Add Note at <span className="text-primary">{formatTimestamp(currentTime)}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Note Content
            </Label>
            <Input
              ref={noteInputRef}
              placeholder="Type your note…"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && noteContent) addNote.mutate()
              }}
              className="bg-muted/30 focus-visible:ring-primary/30"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => addNote.mutate()}
              disabled={!noteContent || addNote.isPending}
              className="font-mono text-xs w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all shadow-md">
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default StudyRoom
