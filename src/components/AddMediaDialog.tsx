import LanguageSelect from '@/components/LanguageSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { languagesDb, videosDb } from '@/integrations/turso/db'
import type { Video } from '@/integrations/turso/types'
import { extractVideoId } from '@/lib/youtube'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export type AddMediaMode = 'choose' | 'video' | 'text'

interface AddMediaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode?: AddMediaMode
  onSaved?: (video: Video) => void
}

const AddMediaDialog = ({
  open,
  onOpenChange,
  initialMode = 'choose',
  onSaved,
}: AddMediaDialogProps) => {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<AddMediaMode>(initialMode)
  const [newUrl, setNewUrl] = useState('')
  const [newText, setNewText] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newLang, setNewLang] = useState('')

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })

  useEffect(() => {
    if (open) setMode(initialMode)
  }, [open, initialMode])

  const reset = () => {
    setMode('choose')
    setNewUrl('')
    setNewText('')
    setNewTitle('')
    setNewLang('')
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) reset()
  }

  const finish = async (video: Video) => {
    await queryClient.invalidateQueries({ queryKey: ['videos'] })
    handleOpenChange(false)
    toast.success(video.media_type === 'video' ? 'Video added' : 'Text added')
    onSaved?.(video)
  }

  const addVideo = useMutation({
    mutationFn: async () => {
      const videoId = extractVideoId(newUrl)
      if (!videoId) throw new Error('Invalid YouTube URL')
      return videosDb.insert({
        media_type: 'video',
        youtube_url: newUrl,
        title: newTitle,
        language: newLang,
        content: null,
      })
    },
    onSuccess: finish,
    onError: (e) => toast.error(e.message),
  })

  const addText = useMutation({
    mutationFn: async () => {
      const content = newText.trim()
      if (!content) throw new Error('Text content is required')
      return videosDb.insert({
        media_type: 'text',
        youtube_url: null,
        title: newTitle.trim(),
        language: newLang,
        content,
      })
    },
    onSuccess: finish,
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {mode === 'choose' ? (
          <>
            <DialogHeader>
              <DialogTitle>Add media</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-28 flex-col gap-2 text-sm font-semibold"
                onClick={() => setMode('video')}>
                <Play className="h-6 w-6 text-primary" />
                Add Video
              </Button>
              <Button
                variant="outline"
                className="h-28 flex-col gap-2 text-sm font-semibold"
                onClick={() => setMode('text')}>
                <FileText className="h-6 w-6 text-primary" />
                Add Text
              </Button>
            </div>
          </>
        ) : mode === 'video' ? (
          <>
            <DialogHeader>
              <DialogTitle>Add YouTube video</DialogTitle>
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
                <Label htmlFor="add-video-language">Language</Label>
                <LanguageSelect
                  id="add-video-language"
                  languages={languages}
                  value={newLang}
                  onChange={setNewLang}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMode('choose')} className="text-sm">
                Back
              </Button>
              <Button
                onClick={() => addVideo.mutate()}
                disabled={!newUrl || !newTitle || !newLang || addVideo.isPending}
                className="text-sm font-semibold">
                {addVideo.isPending ? 'Saving…' : 'Add Video'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add text</DialogTitle>
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
                <Label htmlFor="add-text-language">Language</Label>
                <LanguageSelect
                  id="add-text-language"
                  languages={languages}
                  value={newLang}
                  onChange={setNewLang}
                />
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
              <Button variant="ghost" onClick={() => setMode('choose')} className="text-sm">
                Back
              </Button>
              <Button
                onClick={() => addText.mutate()}
                disabled={!newTitle.trim() || !newText.trim() || addText.isPending}
                className="text-sm font-semibold">
                {addText.isPending ? 'Saving…' : 'Add Text'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AddMediaDialog
