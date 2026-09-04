import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Note, Screenshot } from '@/integrations/turso/types'
import { openDictionary } from '@/lib/dictionary'
import { formatTimestamp } from '@/lib/youtube'
import { BookOpen, ImagePlus, StickyNote, Trash2 } from 'lucide-react'
import { memo } from 'react'

interface NoteListProps {
  notes: Note[]
  language: string
  onSeek: (seconds: number) => void
  onDelete: (noteId: string) => void
  showTimestamp?: boolean
}

const NoteList = memo(function NoteList({
  notes,
  language,
  onSeek,
  onDelete,
  showTimestamp = true,
}: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border/50 rounded-xl bg-card/30">
        <StickyNote className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm font-medium">No notes yet.</p>
        <p className="text-muted-foreground/70 text-xs mt-1">
          Press Ctrl+Enter to take a quick note while watching.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <Card
          key={n.id}
          className="p-4 flex items-start gap-3 border-border/40 bg-card hover:border-primary/30 hover:shadow-md transition-all group rounded-xl">
          {showTimestamp && (
            <Badge
              variant="outline"
              className="cursor-pointer font-mono text-[11px] shrink-0 bg-primary/5 text-primary border-primary/20 hover:bg-primary/20 transition-colors shadow-sm"
              onClick={() => onSeek(n.timestamp)}>
              {formatTimestamp(n.timestamp)}
            </Badge>
          )}
          <p className="text-sm flex-1 min-w-0 leading-relaxed text-foreground/90">{n.content}</p>
          <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
              title="Look up in dictionary"
              onClick={() => openDictionary(n.content.split(/\s+/)[0], language)}>
              <BookOpen className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
              onClick={() => onDelete(n.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
})

interface ScreenshotListProps {
  screenshots: Screenshot[]
  onSeek: (seconds: number) => void
  onDelete: (ssId: string) => void
  showTimestamp?: boolean
}

const ScreenshotList = memo(function ScreenshotList({
  screenshots,
  onSeek,
  onDelete,
  showTimestamp = true,
}: ScreenshotListProps) {
  if (screenshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border/50 rounded-xl bg-card/30">
        <ImagePlus className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm font-medium">No screenshots yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {screenshots.map((s) => (
        <div
          key={s.id}
          className="group relative rounded-xl overflow-hidden border border-border/40 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300">
          <img
            src={s.image_url}
            alt=""
            className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
            <div className="flex items-end justify-between pointer-events-auto">
              {showTimestamp && (
                <Badge
                  variant="outline"
                  className="cursor-pointer font-mono text-[10px] bg-black/60 backdrop-blur-md border-white/20 text-white hover:bg-white/20 hover:border-white/40 transition-all shadow-sm"
                  onClick={() => onSeek(s.timestamp)}>
                  {formatTimestamp(s.timestamp)}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-black/40 backdrop-blur-md text-white/80 hover:text-red-400 hover:bg-red-500/20 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
                onClick={() => onDelete(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})

export { NoteList, ScreenshotList }