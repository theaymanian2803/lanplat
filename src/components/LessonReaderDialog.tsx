import AddLessonContentPanel from '@/components/AddLessonContentPanel'
import AddWordPanel from '@/components/AddWordPanel'
import LessonBlocks from '@/components/LessonBlocks'
import NoteEditor from '@/components/NoteEditor'
import PenOverlay from '@/components/PenOverlay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseBlocks } from '@/lib/lessonBlocks'
import { partSnippet, type NestedLesson } from '@/lib/lessonTree'
import { getTargetLanguage } from '@/lib/targetLanguage'
import { cn } from '@/lib/utils'
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Layers,
  StickyNote,
  X,
} from 'lucide-react'
import { useState } from 'react'

type Panel = 'note' | 'word' | 'lesson'

interface LessonReaderDialogProps {
  lesson: NestedLesson
  initialPartId: string
  onClose: () => void
}

const LessonReaderDialog = ({ lesson, initialPartId, onClose }: LessonReaderDialogProps) => {
  const [selectedPartId, setSelectedPartId] = useState(initialPartId)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [pen, setPen] = useState(false)

  const index = Math.max(
    0,
    lesson.parts.findIndex((part) => part.id === selectedPartId),
  )
  const part = lesson.parts[index]
  const blocks = part ? parseBlocks(part.content) : []
  const language = lesson.language ?? getTargetLanguage() ?? 'Danish'
  const hasVideo = lesson.media_type === 'video' && !!lesson.media_id

  const togglePanel = (next: Panel) => setPanel((current) => (current === next ? null : next))

  const openPen = () => {
    setPanel(null)
    setPen(true)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 data-[state=closed]:animate-none data-[state=open]:animate-none sm:rounded-none">
        <DialogTitle className="sr-only">{lesson.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Read the lesson and capture words, notes or draw on it.
        </DialogDescription>

        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="min-w-0 flex-1">
            <p className="mono-label text-muted-foreground">Lesson</p>
            <h2 className="truncate text-lg font-semibold leading-tight tracking-tight">
              {lesson.title}
            </h2>
          </div>
          {lesson.language && (
            <Badge variant="secondary" className="hidden shrink-0 text-[11px] font-mono sm:inline-flex">
              {lesson.language}
            </Badge>
          )}
          <span className="mono-label hidden shrink-0 text-muted-foreground sm:inline">
            {lesson.parts.length} part{lesson.parts.length === 1 ? '' : 's'}
          </span>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border p-2 md:block">
            <p className="mono-label px-2 py-2 text-muted-foreground">Parts</p>
            {lesson.parts.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedPartId(item.id)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left transition-colors',
                  item.id === part?.id
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}>
                <span className="mono-label mt-0.5 w-10 shrink-0">Part {idx + 1}</span>
                <span className="line-clamp-2 min-w-0 text-xs leading-snug">
                  {partSnippet(item)}
                </span>
              </button>
            ))}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
              {lesson.parts.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedPartId(item.id)}
                  className={cn(
                    'shrink-0 rounded-sm border px-2.5 py-1 text-xs transition-colors',
                    item.id === part?.id
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground',
                  )}>
                  Part {idx + 1}
                </button>
              ))}
            </div>

            <div className="relative flex min-h-0 flex-1">
              <main className="min-w-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-12">
                {part ? (
                  <div className="mx-auto w-full max-w-[75ch]">
                    <p className="mono-label mb-6 text-muted-foreground">
                      Part {index + 1} of {lesson.parts.length}
                    </p>
                    <LessonBlocks blocks={blocks} />
                    <div className="mt-12 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        disabled={index <= 0}
                        onClick={() => setSelectedPartId(lesson.parts[index - 1].id)}>
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <span className="mono-label text-muted-foreground">
                        {index + 1} / {lesson.parts.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        disabled={index >= lesson.parts.length - 1}
                        onClick={() => setSelectedPartId(lesson.parts[index + 1].id)}>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-2 text-center">
                    <GraduationCap className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">This lesson has no parts yet.</p>
                    <p className="text-xs text-muted-foreground">
                      Add a part from Manage Lessons, then reopen the lesson.
                    </p>
                  </div>
                )}
              </main>

              {panel && (
                <aside className="absolute inset-0 z-10 overflow-y-auto border-l border-border bg-background p-4 md:static md:w-80 md:shrink-0">
                  {panel === 'note' && hasVideo && (
                    <NoteEditor
                      videoId={lesson.media_id!}
                      timestamp={0}
                      showTimestamp={false}
                      onClose={() => setPanel(null)}
                    />
                  )}
                  {panel === 'word' && (
                    <AddWordPanel
                      defaultLanguage={language}
                      onClose={() => setPanel(null)}
                      position="right"
                      widthClassName="w-full"
                    />
                  )}
                  {panel === 'lesson' && (
                    <AddLessonContentPanel
                      defaultLanguage={language}
                      onClose={() => setPanel(null)}
                      position="right"
                    />
                  )}
                </aside>
              )}

              <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-l border-border py-3">
                {hasVideo && (
                  <Button
                    size="icon"
                    variant={panel === 'note' ? 'default' : 'secondary'}
                    title="Add Note"
                    onClick={() => togglePanel('note')}>
                    <StickyNote className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant={panel === 'word' ? 'default' : 'secondary'}
                  title="Add Vocabulary"
                  onClick={() => togglePanel('word')}>
                  <BookMarked className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={panel === 'lesson' ? 'default' : 'secondary'}
                  title="Add Lesson Content"
                  onClick={() => togglePanel('lesson')}>
                  <Layers className="h-4 w-4" />
                </Button>
                <div className="my-1 h-px w-6 bg-border" />
                <Button
                  size="icon"
                  variant={pen ? 'default' : 'secondary'}
                  title="Pen / Draw"
                  onClick={openPen}>
                  <span className="font-mono text-sm font-bold leading-none">P</span>
                </Button>
              </div>
            </div>
          </div>

          {pen && (
            <PenOverlay mode="contained" side="right" onClose={() => setPen(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LessonReaderDialog
