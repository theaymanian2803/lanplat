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
import { Input } from '@/components/ui/input'
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
import { Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

type Language = string

const Index = () => {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newUrl, setNewUrl] = useState('')
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
        youtube_url: newUrl,
        title: newTitle,
        language: newLang,
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
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <Button onClick={() => setDialogOpen(true)} className="gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            Add Video
          </Button>
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
          <p className="text-muted-foreground text-sm">No videos yet. Add one above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((v) => {
              const videoId = extractVideoId(v.youtube_url)
              return (
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
    </Layout>
  )
}

export default Index
