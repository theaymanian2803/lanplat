import PartEditor from '@/components/PartEditor'
import LessonEditDialog from '@/components/LessonEditDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { lessonsDb, videosDb, languagesDb } from '@/integrations/turso/db'
import type { Lesson, Part } from '@/integrations/turso/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, FileText, GraduationCap, Languages, Library, Pencil, Plus, Trash2, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

interface LessonsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface LessonRowProps {
  lesson: Lesson & { parts: Part[] }
  active: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

const LessonsPanel = ({ open, onOpenChange }: LessonsPanelProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false)
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonLanguage, setLessonLanguage] = useState<string>('none')

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: lessonsDb.list,
  })

  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: videosDb.list,
  })

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  )
  const selectedPart = useMemo(
    () => selectedLesson?.parts.find((p) => p.id === selectedPartId) ?? null,
    [selectedLesson, selectedPartId],
  )

  const resetSelection = () => {
    setSelectedLessonId(null)
    setSelectedPartId(null)
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lessons'] })

  const addLesson = useMutation({
    mutationFn: async () => {
      const title = lessonTitle.trim()
      if (!title) throw new Error('Lesson title is required')
      return lessonsDb.createLesson({
        title,
        media_type: null,
        media_id: null,
        language: lessonLanguage === 'none' ? null : lessonLanguage,
      })
    },
    onSuccess: (id) => {
      invalidate()
      setLessonDialogOpen(false)
      setLessonTitle('')
      setLessonLanguage('none')
      setSelectedLessonId(id)
      toast.success('Lesson created')
    },
    onError: (e) => toast.error(e.message),
  })

  const updateMedia = useMutation({
    mutationFn: async ({
      lessonId,
      videoId,
    }: {
      lessonId: string
      videoId: string | null
    }) => {
      await lessonsDb.updateLesson(lessonId, {
        media_type: videoId ? 'video' : null,
        media_id: videoId,
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Media context updated')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => lessonsDb.removeLesson(id),
    onSuccess: () => {
      invalidate()
      resetSelection()
      toast.success('Lesson deleted')
    },
    onError: (e) => toast.error(e.message),
  })

  const addPart = useMutation({
    mutationFn: async (lessonId: string) => lessonsDb.createPart({ lesson_id: lessonId }),
    onSuccess: (id) => {
      invalidate()
      setSelectedPartId(id)
      toast.success('Part added')
    },
    onError: (e) => toast.error(e.message),
  })

  const deletePart = useMutation({
    mutationFn: async (id: string) => lessonsDb.removePart(id),
    onSuccess: () => {
      invalidate()
      setSelectedPartId(null)
      toast.success('Part deleted')
    },
    onError: (e) => toast.error(e.message),
  })

  const selectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId)
    const lesson = lessons.find((l) => l.id === lessonId)
    setSelectedPartId(lesson?.parts[0]?.id ?? null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[95%] sm:max-w-none p-0 gap-0 flex flex-col">
        <SheetHeader className="px-6 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Lessons
          </SheetTitle>
          <SheetDescription>
            Organize media into lessons with rich-text parts.
          </SheetDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5 text-xs"
            onClick={() => {
              onOpenChange(false)
              navigate('/lessons')
            }}>
            <Library className="h-3.5 w-3.5" />
            Open Lesson Library
          </Button>
        </SheetHeader>

        <div className="flex-1 min-h-0 grid grid-cols-[200px_200px_1fr] divide-x divide-border/40">
          <div className="flex flex-col min-h-0">
            <div className="p-3 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lessons
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Add lesson"
                onClick={() => setLessonDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <p className="text-xs text-muted-foreground p-2">Loading…</p>
              ) : lessons.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 p-2">No lessons yet.</p>
              ) : (
                lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    active={selectedLessonId === lesson.id}
                    onSelect={() => selectLesson(lesson.id)}
                    onEdit={() => {
                      setEditLesson(lesson)
                      setEditDialogOpen(true)
                    }}
                    onDelete={() => deleteLesson.mutate(lesson.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col min-h-0">
            <div className="p-3 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Parts
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Add part"
                disabled={!selectedLesson}
                onClick={() => selectedLesson && addPart.mutate(selectedLesson.id)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {!selectedLesson ? (
                <p className="text-xs text-muted-foreground/70 p-2">Select a lesson.</p>
              ) : selectedLesson.parts.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 p-2">No parts yet.</p>
              ) : (
                selectedLesson.parts.map((part, idx) => (
                  <div key={part.id} className="space-y-1">
                    <Button
                      variant={selectedPartId === part.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-between gap-1 text-xs font-medium h-auto py-1.5"
                      onClick={() => setSelectedPartId(part.id)}>
                      <span className="truncate">Part {idx + 1}</span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          deletePart.mutate(part.id)
                        }}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        title="Delete part">
                        <Trash2 className="h-3 w-3" />
                      </span>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col min-h-0">
            <div className="p-3 border-b border-border/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Part Content
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedLesson ? (
                <p className="text-xs text-muted-foreground/70">
                  Select a lesson to begin.
                </p>
              ) : !selectedPart ? (
                <p className="text-xs text-muted-foreground/70">Add a part to this lesson.</p>
              ) : (
                <PartEditor part={selectedPart} />
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border/40">
          {selectedLesson && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Media context:
              </Label>
              <Select
                value={selectedLesson.media_id ?? 'none'}
                onValueChange={(v) =>
                  updateMedia.mutate({
                    lessonId: selectedLesson.id,
                    videoId: v === 'none' ? null : v,
                  })
                }>
                <SelectTrigger className="h-8 text-xs font-mono flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No media —</SelectItem>
                  {videos.map((video) => (
                    <SelectItem key={video.id} value={video.id}>
                      <span className="inline-flex items-center gap-1.5">
                        {video.media_type === 'text' ? (
                          <FileText className="h-3 w-3" />
                        ) : (
                          <Video className="h-3 w-3" />
                        )}
                        {video.media_type === 'text' ? `Text: ${video.title}` : video.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </SheetContent>

      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lesson</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Lesson title</Label>
            <Input
              placeholder="e.g. Unit 1 — Introductions"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && lessonTitle.trim()) addLesson.mutate()
              }}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={lessonLanguage} onValueChange={setLessonLanguage}>
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
              onClick={() => addLesson.mutate()}
              disabled={!lessonTitle.trim() || addLesson.isPending}
              className="text-sm font-semibold">
              {addLesson.isPending ? 'Saving…' : 'Add Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LessonEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        lesson={editLesson}
        videos={videos}
      />
    </Sheet>
  )
}

const LessonRow = ({ lesson, active, onSelect, onEdit, onDelete }: LessonRowProps) => (
  <div
    className={`rounded-lg cursor-pointer px-2 py-1.5 transition-colors ${
      active ? 'bg-primary/10' : 'hover:bg-muted/40'
    }`}
    onClick={onSelect}>
    <div className="flex items-center justify-between gap-1">
      <span className="text-xs font-medium truncate">{lesson.title}</span>
      <span className="flex items-center gap-1 shrink-0">
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="text-muted-foreground hover:text-primary shrink-0"
          title="Edit lesson">
          <Pencil className="h-3 w-3" />
        </span>
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-muted-foreground hover:text-destructive shrink-0"
          title="Delete lesson">
          <Trash2 className="h-3 w-3" />
        </span>
      </span>
    </div>
    <div className="flex items-center gap-1 mt-0.5">
      {lesson.media_id ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary/80">
          <Video className="h-2.5 w-2.5" />
          Video
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60">
          <BookOpen className="h-2.5 w-2.5" />
          No media
        </span>
      )}
      {lesson.language && (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground/80">
          <Languages className="h-2.5 w-2.5" />
          {lesson.language}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground/60 font-mono">
        {lesson.parts.length} parts
      </span>
    </div>
  </div>
)

export default LessonsPanel