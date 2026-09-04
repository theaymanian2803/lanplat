import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { notesDb } from '@/integrations/turso/db'
import { formatTimestamp } from '@/lib/youtube'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StickyNote, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

export type PanelPosition = 'left' | 'right'

interface NoteEditorProps {
  videoId: string
  timestamp: number
  onClose: () => void
  position?: PanelPosition
  showTimestamp?: boolean
}

const NoteEditor = ({
  videoId,
  timestamp,
  onClose,
  position = 'left',
  showTimestamp = true,
}: NoteEditorProps) => {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [content, setContent] = useState('')

  const addNote = useMutation({
    mutationFn: async () => {
      await notesDb.insert({
        video_id: videoId,
        timestamp,
        content,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', videoId] })
      setContent('')
      onClose()
      toast.success('Note added')
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <aside
      className={`w-full lg:w-80 shrink-0 bg-card rounded-xl border border-primary/20 shadow-2xl p-5 h-fit animate-in fade-in ${
        position === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
      } duration-300`}>
      <div className="flex items-start justify-between gap-2 mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <StickyNote className="h-4 w-4 text-primary" />
          Add Note{' '}
          {showTimestamp && (
            <span className="text-primary">at {formatTimestamp(timestamp)}</span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Note Content
        </Label>
        <AutoGrowTextarea
          ref={inputRef}
          placeholder="Type your note…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && content) {
              e.preventDefault()
              addNote.mutate()
            }
          }}
          className="bg-muted/30 focus-visible:ring-primary/30"
        />
      </div>
      <Button
        onClick={() => addNote.mutate()}
        disabled={!content || addNote.isPending}
        className="w-full mt-4 transition-all shadow-md hover:shadow-lg hover:shadow-primary/25">
        Save Note
      </Button>
    </aside>
  )
}

export default NoteEditor