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
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { extractVideoId, getThumbnailUrl } from '@/lib/youtube'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

// Changed to string to allow dynamic languages added by the user
type Language = string
const DEFAULT_LANGUAGES: Language[] = ['Danish', 'Japanese', 'Spanish']

const getLangColor = (lang: Language) => {
  const colors: Record<string, string> = {
    Danish: 'bg-red-500/20 text-red-400 border-red-500/30',
    Japanese: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    Spanish: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  }
  // Fallback color for any new custom languages
  return colors[lang] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

const Index = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newLang, setNewLang] = useState<Language>('Danish')
  const [isAddingNewLang, setIsAddingNewLang] = useState(false)

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos', filter],
    queryFn: async () => {
      let q = supabase.from('videos').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('language', filter)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })

  // Combine default languages with any dynamic languages present in the database
  const allLanguages = useMemo(() => {
    const dbLanguages = videos.map((v) => v.language).filter(Boolean)
    return Array.from(new Set([...DEFAULT_LANGUAGES, ...dbLanguages]))
  }, [videos])

  const addVideo = useMutation({
    mutationFn: async () => {
      const videoId = extractVideoId(newUrl)
      if (!videoId) throw new Error('Invalid YouTube URL')
      const { error } = await supabase.from('videos').insert({
        youtube_url: newUrl,
        title: newTitle,
        language: newLang,
        user_id: user!.id,
      } as any) // Cast as any to bypass strict Enum typing on Supabase if not yet updated
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      setDialogOpen(false)
      setNewUrl('')
      setNewTitle('')
      setIsAddingNewLang(false)
      toast.success('Video added')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteVideo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('videos').delete().eq('id', id)
      if (error) throw error
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
          <Button onClick={() => setDialogOpen(true)} className="gap-2 font-mono text-xs">
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
          <ToggleGroupItem value="all" className="font-mono text-xs">
            All
          </ToggleGroupItem>
          {allLanguages.map((l) => (
            <ToggleGroupItem key={l} value={l} className="font-mono text-xs">
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
                        className={`mt-1.5 text-[10px] font-mono ${getLangColor(v.language)}`}>
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
            <DialogTitle className="font-mono">Add YouTube Video</DialogTitle>
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
              {isAddingNewLang ? (
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Type new language"
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingNewLang(false)
                      setNewLang('Danish')
                    }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <Select value={newLang} onValueChange={(v) => setNewLang(v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allLanguages.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Add custom language"
                    onClick={() => {
                      setIsAddingNewLang(true)
                      setNewLang('')
                    }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addVideo.mutate()}
              disabled={!newUrl || !newTitle || !newLang || addVideo.isPending}
              className="font-mono text-xs">
              {addVideo.isPending ? 'Saving…' : 'Add Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default Index
