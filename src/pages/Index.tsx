import Layout from '@/components/Layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { languagesDb, videosDb } from '@/integrations/turso/db'
import { getLangBadgeClasses, getLangDotClass } from '@/lib/langColors'
import { extractVideoId, getThumbnailUrl } from '@/lib/youtube'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

type Language = string

const Index = () => {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [textDialogOpen, setTextDialogOpen] = useState(false)
  const [newText, setNewText] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newLang, setNewLang] = useState<Language>('Danish')

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos', filter],
    queryFn: async () => videosDb.list(filter === 'all' ? undefined : filter),
  })

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })

  const addVideo = useMutation({
    mutationFn: async () => {
      const videoId = extractVideoId(newUrl)
      if (!videoId) throw new Error('Invalid YouTube URL')
      await videosDb.insert({
        media_type: 'video',
        youtube_url: newUrl,
        title: newTitle,
        language: newLang,
        content: null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      setDialogOpen(false)
      setNewUrl('')
      setNewTitle('')
      toast.success('Video added')
    },
    onError: (e) => toast.error(e.message),
  })

  const addText = useMutation({
    mutationFn: async () => {
      const content = newText.trim()
      if (!content) throw new Error('Text content is required')
      await videosDb.insert({
        media_type: 'text',
        youtube_url: null,
        title: newTitle.trim(),
        language: newLang,
        content,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      setTextDialogOpen(false)
      setNewText('')
      setNewTitle('')
      toast.success('Text added')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteVideo = useMutation({
    mutationFn: async (id: string) => {
      await videosDb.remove(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      toast.success('Video removed')
    },
  })

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight" data-tour="dashboard-heading">Dashboard</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 text-sm font-semibold" data-tour="add-video">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialogOpen(true)} className="gap-2">
                <Play className="h-4 w-4" />
                Add Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTextDialogOpen(true)} className="gap-2">
                <FileText className="h-4 w-4" />
                Add Text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Language filter */}
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          className="justify-start flex-wrap">
          <ToggleGroupItem value="all" className="text-sm font-medium">
            All
          </ToggleGroupItem>
          {languages.map((l) => (
            <ToggleGroupItem key={l} value={l} className="text-sm font-medium">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Grid */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : videos.length === 0 ? (
          <p className="text-muted-foreground text-sm">No media yet. Add one above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((v) => {
              const videoId = extractVideoId(v.youtube_url ?? '')
              return v.media_type === 'text' ? (
                <Card
                  key={v.id}
                  className="group overflow-hidden border-border/50 hover:border-primary/30 transition-colors">
                  <Link to={`/video/${v.id}`}>
                    <div className="relative aspect-video bg-muted p-4 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-primary/80" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                          Text
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed line-clamp-3 whitespace-pre-wrap text-muted-foreground/80">
                        {v.content}
                      </p>
                    </div>
                  </Link>
                  <CardContent className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/video/${v.id}`}
                        className="font-medium text-sm truncate block hover:text-primary transition-colors">
                        {v.title}
                      </Link>
                      <Badge
                        variant="outline"
                        className={`mt-1.5 text-[10px] font-mono inline-flex items-center gap-1.5 ${getLangBadgeClasses(v.language)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(v.language)}`} />
                        {v.language}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      onClick={(e) => {
                        e.preventDefault()
                        deleteVideo.mutate(v.id)
                      }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card
                  key={v.id}
                  className="group overflow-hidden border-border/50 hover:border-primary/30 transition-colors">
                  <Link to={`/video/${v.id}`}>
                    <div className="relative aspect-video bg-muted">
                      {videoId && (
                        <img
                          src={getThumbnailUrl(videoId)}
                          alt={v.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="h-10 w-10 text-white" />
                      </div>
                    </div>
                  </Link>
                  <CardContent className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/video/${v.id}`}
                        className="font-medium text-sm truncate block hover:text-primary transition-colors">
                        {v.title}
                      </Link>
                      <Badge
                        variant="outline"
                        className={`mt-1.5 text-[10px] font-mono inline-flex items-center gap-1.5 ${getLangBadgeClasses(v.language)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(v.language)}`} />
                        {v.language}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      onClick={(e) => {
                        e.preventDefault()
                        deleteVideo.mutate(v.id)
                      }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Video Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add YouTube Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>YouTube URL</Label>
              <Input
                placeholder="https://youtube.com/watch?v=..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Video title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={newLang} onValueChange={(v) => setNewLang(v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addVideo.mutate()}
              disabled={!newUrl || !newTitle || !newLang || addVideo.isPending}
              className="text-sm font-semibold">
              {addVideo.isPending ? 'Saving…' : 'Add Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Text</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Chapter 1 — The Journey"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={newLang} onValueChange={(v) => setNewLang(v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Text content</Label>
              <Textarea
                placeholder="Paste the full text here…"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addText.mutate()}
              disabled={!newTitle.trim() || !newText.trim() || addText.isPending}
              className="text-sm font-semibold">
              {addText.isPending ? 'Saving…' : 'Add Text'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default Index
