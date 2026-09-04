import Layout from '@/components/Layout'
import LessonBlocks from '@/components/LessonBlocks'
import LessonEditDialog from '@/components/LessonEditDialog'
import { useOpenLessonsDrawer } from '@/lib/lessonsDrawer'
import { lessonsDb, videosDb } from '@/integrations/turso/db'
import type { NestedLesson } from '@/lib/lessonTree'
import type { Video as VideoRow } from '@/integrations/turso/types'
import { parseBlocks } from '@/lib/lessonBlocks'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  FileText,
  GraduationCap,
  Languages,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

const LessonsPage = () => {
  const openDrawer = useOpenLessonsDrawer()
  const queryClient = useQueryClient()
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [editingLesson, setEditingLesson] = useState<NestedLesson | null>(null)
  const [deletingLesson, setDeletingLesson] = useState<NestedLesson | null>(null)

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: lessonsDb.list,
  })

  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: videosDb.list,
  })

  const videoTitles = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of videos) map.set(v.id, v.title)
    return map
  }, [videos])

  const mediaTypes = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of videos as VideoRow[]) map.set(v.id, v.media_type)
    return map
  }, [videos])

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  )

  const totalParts = useMemo(
    () => lessons.reduce((acc, l) => acc + l.parts.length, 0),
    [lessons],
  )

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => lessonsDb.removeLesson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      setDeletingLesson(null)
      setSelectedLessonId(null)
      toast.success('Lesson deleted')
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <GraduationCap className="h-6 w-6 text-primary" />
              Lesson Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lessons.length} lessons · {totalParts} parts. Use the Lessons drawer to build
              content, read it here in full screen.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 text-sm font-medium" onClick={openDrawer}>
            <Plus className="h-4 w-4" />
            Manage Lessons
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : lessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border/50 rounded-2xl bg-card/30 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm font-medium">No lessons yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
              Create lessons and rich-text parts from the management drawer.
            </p>
            <Button size="sm" className="gap-2" onClick={openDrawer}>
              <Plus className="h-4 w-4" />
              Create First Lesson
            </Button>
          </div>
        ) : selectedLesson ? (
          <LessonDetail
            lesson={selectedLesson}
            onBack={() => setSelectedLessonId(null)}
            onEdit={() => setEditingLesson(selectedLesson)}
            onDelete={() => setDeletingLesson(selectedLesson)}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                videoTitle={lesson.media_id ? videoTitles.get(lesson.media_id) : undefined}
                mediaTypes={mediaTypes}
                onClick={() => setSelectedLessonId(lesson.id)}
                onEdit={() => setEditingLesson(lesson)}
                onDelete={() => setDeletingLesson(lesson)}
              />
            ))}
          </div>
        )}
      </div>

      <LessonEditDialog
        open={!!editingLesson}
        onOpenChange={(o) => !o && setEditingLesson(null)}
        lesson={editingLesson}
        videos={videos}
      />

      <AlertDialog open={!!deletingLesson} onOpenChange={(o) => !o && setDeletingLesson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &quot;{deletingLesson?.title}&quot; and all of its
              parts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingLesson && deleteLesson.mutate(deletingLesson.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}

interface LessonCardProps {
  lesson: NestedLesson
  videoTitle?: string
  mediaTypes: Map<string, string>
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}

const LessonCard = ({ lesson, videoTitle, mediaTypes, onClick, onEdit, onDelete }: LessonCardProps) => {
  const parts = lesson.parts.length
  return (
    <div
      className="group cursor-pointer rounded-2xl border border-border/40 bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
      onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight leading-snug">
          {lesson.title}
        </h2>
        <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            title="Edit lesson"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete lesson"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {lesson.media_id ? (
          <Badge variant="outline" className="gap-1 text-[11px] font-mono text-primary/80">
            {mediaTypes.get(lesson.media_id) === 'text' ? (
              <>
                <FileText className="h-3 w-3" />
                {videoTitle ?? 'Text'}
              </>
            ) : (
              <>
                <Video className="h-3 w-3" />
                {videoTitle ?? 'Video'}
              </>
            )}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-[11px] font-mono text-muted-foreground/70">
            <BookOpen className="h-3 w-3" />
            No media
          </Badge>
        )}
        <Badge variant="secondary" className="gap-1 text-[11px] font-mono">
          <Layers className="h-3 w-3" />
          {parts} part{parts === 1 ? '' : 's'}
        </Badge>
        {lesson.language && (
          <Badge variant="secondary" className="gap-1 text-[11px] font-mono text-primary/80">
            <Languages className="h-3 w-3" />
            {lesson.language}
          </Badge>
        )}
      </div>
    </div>
  )
}

interface LessonDetailProps {
  lesson: NestedLesson
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

const LessonDetail = ({ lesson, onBack, onEdit, onDelete }: LessonDetailProps) => {
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())

  const togglePart = (partId: string) => {
    setExpandedParts((prev) => {
      const next = new Set(prev)
      if (next.has(partId)) next.delete(partId)
      else next.add(partId)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" className="gap-1 text-sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Library
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight truncate">
            {lesson.title}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {lesson.parts.length} part{lesson.parts.length === 1 ? '' : 's'}
            {lesson.language && (
              <span className="inline-flex items-center gap-1 text-primary/80">
                <span className="mx-1.5 text-muted-foreground/40">·</span>
                <Languages className="h-3 w-3" />
                {lesson.language}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {lesson.parts.length === 0 ? (
        <div className="border border-dashed border-border/50 rounded-2xl py-12 text-center">
          <p className="text-sm text-muted-foreground">
            This lesson has no parts yet. Manage it from the Lessons drawer.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lesson.parts.map((part, idx) => {
            const isOpen = expandedParts.has(part.id)
            const blocks = parseBlocks(part.content)
            return (
              <div
                key={part.id}
                className={`rounded-2xl border bg-card p-4 cursor-pointer transition-all shadow-sm ${
                  isOpen
                    ? 'border-primary/40 shadow-md shadow-primary/5'
                    : 'border-border/40 hover:border-primary/30'
                }`}
                onClick={() => togglePart(part.id)}>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70">
                    Part {idx + 1}
                  </h4>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                {blocks.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">Empty part.</p>
                ) : isOpen ? (
                  <LessonBlocks blocks={blocks} />
                ) : (
                  <div>
                    <div className="line-clamp-4">
                      <LessonBlocks blocks={blocks} />
                    </div>
                    <span className="text-[10px] font-mono text-primary/70 mt-1.5 inline-block">
                      Read more
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default LessonsPage