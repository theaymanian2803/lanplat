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
import { BookOpen, ImagePlus, PenTool, StickyNote, Trash2 } from 'lucide-react'
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

  // A-B Loop state
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load YouTube IFrame API
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

  // Initialize player
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

  // A-B Loop polling
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      // Ctrl/Cmd+Enter always works — focus note input
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setCurrentTime(getCurrentPlayerTime())
        setNoteDialogOpen(true)
        setTimeout(() => noteInputRef.current?.focus(), 100)
        return
      }

      // Other shortcuts only when not in an input
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

  // Notes queries
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

  // Screenshots queries
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
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadScreenshot.mutate(file)
    e.target.value = ''
  }

  if (!video)
    return (
      <Layout>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </Layout>
    )

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold tracking-tight truncate">{video.title}</h1>

        {/* Player + Whiteboard with Resizable Split */}
        <ResizablePanelGroup
          direction="horizontal"
          className={`rounded-lg border border-border overflow-hidden ${!whiteboardOpen ? 'aspect-video' : ''}`}
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
              <ResizableHandle withHandle />
            </>
          )}
          <ResizablePanel defaultSize={whiteboardOpen ? 50 : 100} minSize={20} maxSize={100}>
            <div className="w-full h-full bg-black overflow-hidden">
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
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setCurrentTime(getCurrentPlayerTime())
              setNoteDialogOpen(true)
            }}
            className="gap-2 font-mono text-xs">
            <StickyNote className="h-4 w-4" />
            Add Note
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 font-mono text-xs"
            disabled={uploadScreenshot.isPending}>
            <ImagePlus className="h-4 w-4" />
            {uploadScreenshot.isPending ? 'Uploading…' : 'Screenshot'}
          </Button>
          <Button
            variant={whiteboardOpen ? 'default' : 'secondary'}
            onClick={() => setWhiteboardOpen((v) => !v)}
            className="gap-2 font-mono text-xs">
            <PenTool className="h-4 w-4" />
            {whiteboardOpen ? 'Close Board' : 'Whiteboard'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Keyboard hints */}
        <div className="flex gap-3 text-[10px] text-muted-foreground font-mono">
          <span>Space: play/pause</span>
          <span>←→: ±5s</span>
          <span>Ctrl+Enter: quick note</span>
        </div>

        {/* Notes & Screenshots Tabs */}
        <Tabs defaultValue="notes">
          <TabsList>
            <TabsTrigger value="notes" className="font-mono text-xs">
              Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="screenshots" className="font-mono text-xs">
              Screenshots ({screenshots.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-2 mt-4">
            {notes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No notes yet.</p>
            ) : (
              notes.map((n) => (
                <Card key={n.id} className="p-3 flex items-start gap-3 border-border/50">
                  <Badge
                    variant="outline"
                    className="cursor-pointer font-mono text-[11px] shrink-0 hover:bg-primary/20 transition-colors"
                    onClick={() => seekTo(n.timestamp)}>
                    {formatTimestamp(n.timestamp)}
                  </Badge>
                  <p className="text-sm flex-1 min-w-0">{n.content}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      title="Look up in dictionary"
                      onClick={() => openDictionary(n.content.split(/\s+/)[0], video.language)}>
                      <BookOpen className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteNote.mutate(n.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="screenshots" className="mt-4">
            {screenshots.length === 0 ? (
              <p className="text-muted-foreground text-sm">No screenshots yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {screenshots.map((s) => (
                  <div
                    key={s.id}
                    className="group relative rounded-lg overflow-hidden border border-border/50">
                    <img
                      src={s.image_url}
                      alt=""
                      className="w-full aspect-video object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between">
                      <Badge
                        variant="outline"
                        className="cursor-pointer font-mono text-[10px] bg-black/50 border-white/20 text-white hover:bg-white/20"
                        onClick={() => seekTo(s.timestamp)}>
                        {formatTimestamp(s.timestamp)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-white/60 hover:text-red-400 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteScreenshot.mutate(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">
              Add Note at {formatTimestamp(currentTime)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note</Label>
            <Input
              ref={noteInputRef}
              placeholder="Type your note…"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && noteContent) addNote.mutate()
              }}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => addNote.mutate()}
              disabled={!noteContent || addNote.isPending}
              className="font-mono text-xs">
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default StudyRoom
