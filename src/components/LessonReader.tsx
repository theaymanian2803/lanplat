import AddLessonContentPanel from '@/components/AddLessonContentPanel'
import AddWordPanel from '@/components/AddWordPanel'
import LessonBlocks from '@/components/LessonBlocks'
import NoteEditor from '@/components/NoteEditor'
import PenOverlay from '@/components/PenOverlay'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'
import { useState } from 'react'

type Panel = 'note' | 'word' | 'lesson'

interface LessonReaderProps {
  lesson: NestedLesson
  partId?: string
  onPartChange: (id: string) => void
}

const LessonReader = ({ lesson, partId, onPartChange }: LessonReaderProps) => {
  const [panel, setPanel] = useState<Panel | null>(null)
  const [pen, setPen] = useState(false)

  const index = Math.max(
    0,
    lesson.parts.findIndex((part) => part.id === partId),
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
    <div className="relative flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
      {lesson.parts.length > 0 && (
        <>
          <aside className="hidden w-56 shrink-0 self-start rounded-sm border border-border bg-card/30 p-2 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
            <p className="mono-label px-2 py-2 text-muted-foreground">Parts</p>
            {lesson.parts.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPartChange(item.id)}
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

          <div className="flex gap-2 overflow-x-auto border-y border-border px-1 py-2 lg:hidden">
            {lesson.parts.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPartChange(item.id)}
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
        </>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
        <section className="min-w-0 flex-1" aria-label="Lesson content">
          {part ? (
            <div className="min-w-0 break-words">
              <p className="mono-label mb-5 text-muted-foreground">
                Part {index + 1} of {lesson.parts.length}
              </p>
              {blocks.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border/50 px-4 py-10 text-center">
                  <p className="text-sm font-medium">This part is empty.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use Add Lesson Content or Manage to fill it.
                  </p>
                </div>
              ) : (
                <LessonBlocks blocks={blocks} />
              )}
              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={index <= 0}
                  onClick={() => onPartChange(lesson.parts[index - 1].id)}>
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
                  onClick={() => onPartChange(lesson.parts[index + 1].id)}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border/50 px-4 py-12 text-center">
              <GraduationCap className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">This lesson has no parts yet.</p>
              <p className="text-xs text-muted-foreground">
                Add a part from Manage to get started.
              </p>
            </div>
          )}
        </section>

        {panel && (
          <aside className="absolute inset-0 z-20 overflow-y-auto rounded-sm border border-border bg-background p-4 lg:static lg:w-80 lg:shrink-0">
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

        <div className="order-first flex shrink-0 flex-row flex-wrap items-center gap-2 rounded-sm border border-border bg-card/40 p-2 sm:order-last sm:sticky sm:top-4 sm:w-14 sm:flex-col sm:flex-nowrap sm:self-start">
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
          <div className="my-1 hidden h-px w-6 bg-border sm:block" />
          <Button
            size="icon"
            variant={pen ? 'default' : 'secondary'}
            title="Pen / Draw"
            onClick={openPen}>
            <span className="font-mono text-sm font-bold leading-none">P</span>
          </Button>
        </div>
      </div>

      {pen && (
        <PenOverlay mode="viewport" side="right" onClose={() => setPen(false)} />
      )}
    </div>
  )
}

export default LessonReader
