import AddLessonDialog from '@/components/AddLessonDialog'
import AddMediaDialog from '@/components/AddMediaDialog'
import Layout from '@/components/Layout'
import LessonEditDialog from '@/components/LessonEditDialog'
import LessonReader from '@/components/LessonReader'
import { useOpenLessonsDrawer } from '@/lib/lessonsDrawer'
import { lessonsDb, videosDb } from '@/integrations/turso/db'
import type { NestedLesson } from '@/lib/lessonTree'
import type { Video as VideoRow } from '@/integrations/turso/types'
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  FileText,
  GraduationCap,
  Languages,
  Layers,
  Library,
  Pencil,
  Play,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

const LessonsPage = () => {
  const openDrawer = useOpenLessonsDrawer()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedLessonId = searchParams.get('lesson')
  const selectedPartId = searchParams.get('part') ?? undefined
  const [editingLesson, setEditingLesson] = useState<NestedLesson | null>(null)
  const [deletingLesson, setDeletingLesson] = useState<NestedLesson | null>(null)
  const [addMediaOpen, setAddMediaOpen] = useState(false)
  const [addMediaMode, setAddMediaMode] = useState<'video' | 'text'>('video')
  const [addLessonOpen, setAddLessonOpen] = useState(false)

  const openLesson = (id: string) => setSearchParams({ lesson: id })
  const closeLesson = () => setSearchParams({})
  const selectPart = (id: string) => {
    if (!selectedLessonId) return
    setSearchParams({ lesson: selectedLessonId, part: id })
  }

  const lastLessonRef = useRef<{ lessonId: string; partId?: string } | null>(null)

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: lessonsDb.list,
  })

  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: () => videosDb.list(),
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
  const selectedPartIndex = selectedLesson
    ? Math.max(0, selectedLesson.parts.findIndex((p) => p.id === selectedPartId))
    : -1
  const selectedPart = selectedLesson?.parts[selectedPartIndex]

  useEffect(() => {
    if (selectedLessonId) {
      lastLessonRef.current = { lessonId: selectedLessonId, partId: selectedPartId }
    }
  }, [selectedLessonId, selectedPartId])

  const canGoBack = !!selectedLesson
  const canGoForward = selectedLesson
    ? selectedPartIndex < selectedLesson.parts.length - 1
    : !!lastLessonRef.current

  const goBack = () => {
    if (!selectedLesson) return
    if (selectedPartIndex > 0) {
      selectPart(selectedLesson.parts[selectedPartIndex - 1].id)
    } else {
      closeLesson()
    }
  }

  const goForward = () => {
    if (selectedLesson) {
      if (selectedPartIndex < selectedLesson.parts.length - 1) {
        selectPart(selectedLesson.parts[selectedPartIndex + 1].id)
      }
      return
    }
    const last = lastLessonRef.current
    if (!last) return
    setSearchParams(
      last.partId
        ? { lesson: last.lessonId, part: last.partId }
        : { lesson: last.lessonId },
    )
  }

  const totalParts = useMemo(
    () => lessons.reduce((acc, l) => acc + l.parts.length, 0),
    [lessons],
  )

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => lessonsDb.removeLesson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      setDeletingLesson(null)
      closeLesson()
      toast.success('Lesson deleted')
    },
    onError: (e) => toast.error(e.message),
  })

  // A video or text added from this page becomes a lesson straight away, so it
  // shows up in the library and opens in the reader.
  const wrapMediaInLesson = useMutation({
    mutationFn: async (media: VideoRow) => {
      const lessonId = await lessonsDb.createLesson({
        title: media.title,
        media_type: 'video',
        media_id: media.id,
        language: media.language || null,
      })
      await lessonsDb.createPart({ lesson_id: lessonId })
      return lessonId
    },
    onSuccess: async (lessonId) => {
      await queryClient.invalidateQueries({ queryKey: ['lessons'] })
      openLesson(lessonId)
      toast.success('Lesson created')
    },
    onError: (e) => toast.error(e.message),
  })

  const openMediaDialog = (mode: 'video' | 'text') => {
    setAddMediaMode(mode)
    setAddMediaOpen(true)
  }

  const addMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" />
          Add
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem className="gap-2" onSelect={() => openMediaDialog('video')}>
          <Video className="h-4 w-4" />
          Video
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => openMediaDialog('text')}>
          <FileText className="h-4 w-4" />
          Text
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => setAddLessonOpen(true)}>
          <GraduationCap className="h-4 w-4" />
          Lesson
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Go back"
              title="Go back"
              onClick={goBack}
              disabled={!canGoBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Go forward"
              title="Go forward"
              onClick={goForward}
              disabled={!canGoForward}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {selectedLesson ? (
                  <BreadcrumbLink asChild>
                    <Link to="/lessons">Lessons Library</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>Lessons Library</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {selectedLesson && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {selectedPart ? (
                      <BreadcrumbLink asChild>
                        <Link to={`/lessons?lesson=${selectedLesson.id}`}>
                          {selectedLesson.title}
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{selectedLesson.title}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </>
              )}
              {selectedLesson && selectedPart && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Part {selectedPartIndex + 1}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-[30px] font-extrabold leading-tight tracking-[-0.035em]">
              <GraduationCap className="h-6 w-6 text-primary" />
              Lessons Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lessons.length} lessons · {totalParts} parts. Open a lesson to read it here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-sm font-medium"
              onClick={openDrawer}>
              <Library className="h-4 w-4" />
              Manage
            </Button>
            {addMenu}
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : lessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border/50 rounded-2xl bg-card/30 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm font-medium">No lessons yet.</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Add a video, a text, or a blank lesson to start.
            </p>
            {addMenu}
          </div>
        ) : selectedLesson ? (
          <LessonDetail
            lesson={selectedLesson}
            mediaTypes={mediaTypes}
            partId={selectedPartId}
            onPartChange={selectPart}
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
                onClick={() => openLesson(lesson.id)}
                onEdit={() => setEditingLesson(lesson)}
                onDelete={() => setDeletingLesson(lesson)}
              />
            ))}
          </div>
        )}
      </div>

      <AddMediaDialog
        open={addMediaOpen}
        onOpenChange={setAddMediaOpen}
        initialMode={addMediaMode}
        onSaved={(media) => wrapMediaInLesson.mutate(media)}
      />

      <AddLessonDialog
        open={addLessonOpen}
        onOpenChange={setAddLessonOpen}
        onCreated={({ lessonId }) => openLesson(lessonId)}
      />

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
      className="group cursor-pointer rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/40"
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
          <Badge variant="outline" className="gap-1 text-[11px] font-mono text-muted-foreground">
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
  mediaTypes: Map<string, string>
  partId?: string
  onPartChange: (id: string) => void
  onEdit: () => void
  onDelete: () => void
}

const LessonDetail = ({
  lesson,
  mediaTypes,
  partId,
  onPartChange,
  onEdit,
  onDelete,
}: LessonDetailProps) => {
  const mediaIsText = lesson.media_id ? mediaTypes.get(lesson.media_id) === 'text' : false
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
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
          {lesson.media_id && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <Link to={`/video/${lesson.media_id}`}>
                {mediaIsText ? (
                  <FileText className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Open {mediaIsText ? 'text' : 'video'}
              </Link>
            </Button>
          )}
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

      <LessonReader
        key={lesson.id}
        lesson={lesson}
        partId={partId}
        onPartChange={onPartChange}
      />
    </div>
  )
}

export default LessonsPage
