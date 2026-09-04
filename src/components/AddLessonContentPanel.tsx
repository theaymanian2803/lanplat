import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea'
import { useAutoTranslate } from '@/hooks/useAutoTranslate'
import { lessonsDb } from '@/integrations/turso/db'
import { appendBlockToContent, createBlock } from '@/lib/lessonBlocks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { PanelPosition } from '@/components/NoteEditor'

interface AddLessonContentPanelProps {
  defaultLanguage: string
  onClose: () => void
  position?: PanelPosition
}

const NEW_PART = '__new__'

const AddLessonContentPanel = ({ defaultLanguage, onClose, position = 'left' }: AddLessonContentPanelProps) => {
  const queryClient = useQueryClient()
  const [lessonId, setLessonId] = useState('')
  const [partId, setPartId] = useState('')
  const [word, setWord] = useState('')
  const [translation, setTranslation] = useState('')

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons'],
    queryFn: lessonsDb.list,
  })

  const languageLessons = useMemo(
    () => lessons.filter((l) => l.language === defaultLanguage),
    [lessons, defaultLanguage]
  )
  const lessonOptions = languageLessons.length > 0 ? languageLessons : lessons

  const lesson = lessonOptions.find((l) => l.id === lessonId)
  const parts = lesson?.parts ?? []
  const selectedPart = parts.find((p) => p.id === partId)
  const lessonLanguage = lesson?.language ?? defaultLanguage

  const { translating, markUserEdit, error } = useAutoTranslate(
    word,
    lessonLanguage,
    translation,
    setTranslation
  )

  useEffect(() => {
    setPartId('')
  }, [lessonId])

  const addContent = useMutation({
    mutationFn: async () => {
      const blockText = translation.trim()
        ? `${word.trim()} — ${translation.trim()}`
        : word.trim()
      const targetPartId =
        partId === NEW_PART ? await lessonsDb.createPart({ lesson_id: lessonId }) : partId
      const targetContent =
        partId === NEW_PART ? '[]' : (selectedPart?.content ?? '[]')
      await lessonsDb.updatePart(
        targetPartId,
        appendBlockToContent(targetContent, createBlock('p', blockText))
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      setWord('')
      setTranslation('')
      toast.success('Added to lesson!')
    },
    onError: (e) => toast.error(e.message),
  })

  const canSave = lessonId && partId && word.trim() && !addContent.isPending

  return (
    <aside
      className={`w-full lg:w-80 shrink-0 bg-card rounded-xl border border-primary/20 shadow-2xl p-5 h-fit animate-in fade-in ${
        position === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
      } duration-300`}>
      <div className="flex items-start justify-between gap-2 mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Layers className="h-4 w-4 text-primary" />
          Add Lesson Content
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {lessonOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground/80 text-center py-6 border border-dashed border-border/50 rounded-xl">
          No lessons yet — create one in the Lessons library first.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Lesson
            </Label>
            <Select value={lessonId} onValueChange={setLessonId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a lesson" />
              </SelectTrigger>
              <SelectContent>
                {lessonOptions.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title}
                    {l.language ? ` · ${l.language}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {lesson && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Part
              </Label>
              {parts.length === 0 ? (
                <p className="text-xs text-muted-foreground/80 text-center py-3 border border-dashed border-border/50 rounded-xl">
                  No parts in this lesson yet — add them in the Lessons library.
                </p>
              ) : (
                <Select value={partId} onValueChange={setPartId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a part" />
                  </SelectTrigger>
                  <SelectContent>
                    {parts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        Part {p.position}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_PART}>+ New Part</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {lesson && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Word / Text
              </Label>
              <div className="relative">
                <AutoGrowTextarea
                  placeholder="e.g. at spise"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && canSave) {
                      e.preventDefault()
                      addContent.mutate()
                    }
                  }}
                  className="bg-muted/30 focus-visible:ring-primary/30 pr-8"
                />
                {translating && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {error && !translating && (
                <p className="text-xs text-destructive mt-1">
                  {error} - type the translation manually.
                </p>
              )}
            </div>
          )}

          {lesson && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Translation
              </Label>
              <AutoGrowTextarea
                placeholder="e.g. to eat"
                value={translation}
                onChange={(e) => {
                  markUserEdit()
                  setTranslation(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && canSave) {
                    e.preventDefault()
                    addContent.mutate()
                  }
                }}
                className="bg-muted/30 focus-visible:ring-primary/30"
              />
            </div>
          )}

          {lesson && (
            <Button
              onClick={() => addContent.mutate()}
              disabled={!canSave}
              className="w-full mt-2 transition-all shadow-md hover:shadow-lg hover:shadow-primary/25">
              {addContent.isPending ? 'Saving…' : 'Add to Lesson'}
            </Button>
          )}
        </div>
      )}
    </aside>
  )
}

export default AddLessonContentPanel