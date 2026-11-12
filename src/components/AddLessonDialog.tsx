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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { languagesDb, lessonsDb } from '@/integrations/turso/db'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface AddLessonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (created: { lessonId: string; partId: string }) => void
}

const AddLessonDialog = ({ open, onOpenChange, onCreated }: AddLessonDialogProps) => {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('none')

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })

  useEffect(() => {
    if (open) {
      setTitle('')
      setLanguage('none')
    }
  }, [open])

  const createLesson = useMutation({
    mutationFn: async () => {
      const trimmed = title.trim()
      if (!trimmed) throw new Error('Lesson title is required')
      const lessonId = await lessonsDb.createLesson({
        title: trimmed,
        media_type: null,
        media_id: null,
        language: language === 'none' ? null : language,
      })
      const partId = await lessonsDb.createPart({ lesson_id: lessonId })
      return { lessonId, partId }
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['lessons'] })
      onOpenChange(false)
      toast.success('Lesson created')
      onCreated?.(created)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Lesson</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Lesson title</Label>
          <Input
            placeholder="e.g. Unit 1 — Introductions"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) createLesson.mutate()
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
        <DialogFooter>
          <Button
            onClick={() => createLesson.mutate()}
            disabled={!title.trim() || createLesson.isPending}
            className="text-sm font-semibold">
            {createLesson.isPending ? 'Saving…' : 'Add Lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AddLessonDialog
