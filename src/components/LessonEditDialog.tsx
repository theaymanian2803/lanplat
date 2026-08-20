import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { lessonsDb, languagesDb } from '@/integrations/turso/db'
import type { Lesson, Video } from '@/integrations/turso/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface LessonEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: Lesson | null
  videos: Video[]
}

const LessonEditDialog = ({ open, onOpenChange, lesson, videos }: LessonEditDialogProps) => {
  const queryClient = useQueryClient()
  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })
  const [title, setTitle] = useState('')
  const [mediaId, setMediaId] = useState<string>('none')
  const [language, setLanguage] = useState<string>('none')

  useEffect(() => {
    if (open && lesson) {
      setTitle(lesson.title)
      setMediaId(lesson.media_id ?? 'none')
      setLanguage(lesson.language ?? 'none')
    }
  }, [open, lesson])

  const save = useMutation({
    mutationFn: async () => {
      if (!lesson) return
      const trimmed = title.trim()
      if (!trimmed) throw new Error('Lesson title is required')
      await lessonsDb.updateLesson(lesson.id, {
        title: trimmed,
        media_type: mediaId === 'none' ? null : 'video',
        media_id: mediaId === 'none' ? null : mediaId,
        language: language === 'none' ? null : language,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      onOpenChange(false)
      toast.success('Lesson updated')
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lesson</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lesson title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) save.mutate()
              }}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No language —</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Media context</Label>
            <Select value={mediaId} onValueChange={setMediaId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select media" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No media —</SelectItem>
                {videos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={!title.trim() || save.isPending}
            className="text-sm font-semibold">
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default LessonEditDialog