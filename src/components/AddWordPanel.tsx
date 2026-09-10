import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { languagesDb, vocabularyDb } from '@/integrations/turso/db'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookMarked, Loader2, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAutoTranslate } from '@/hooks/useAutoTranslate'
import { speakWord } from '@/lib/tts'
import type { PanelPosition } from '@/components/NoteEditor'

interface AddWordPanelProps {
  defaultLanguage: string
  onClose: () => void
  position?: PanelPosition
  initialWord?: string
}

const AddWordPanel = ({ defaultLanguage, onClose, position = 'left', initialWord }: AddWordPanelProps) => {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const savingRef = useRef(false)
  const [word, setWord] = useState(initialWord ?? '')
  const [translation, setTranslation] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [wordLang, setWordLang] = useState(defaultLanguage)

  const { translating, markUserEdit, error } = useAutoTranslate(word, wordLang, translation, setTranslation)

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })

  useEffect(() => {
    setWordLang(defaultLanguage)
  }, [defaultLanguage])

  useEffect(() => {
    setWord(initialWord ?? '')
    setTranslation('')
    setContextNote('')
  }, [initialWord])

  const addWord = useMutation({
    mutationFn: async () => {
      await vocabularyDb.insert({
        language: wordLang,
        word,
        translation,
        context_note: contextNote || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] })
      setWord('')
      setTranslation('')
      setContextNote('')
      toast.success('Word saved to Vocab Bank!')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save word'),
    onSettled: () => {
      savingRef.current = false
    },
  })

  const canSave = !!word.trim() && !!translation.trim() && !!wordLang

  const handleSave = () => {
    if (!canSave || addWord.isPending || savingRef.current) return
    savingRef.current = true
    addWord.mutate()
  }

  const options = languages.includes(defaultLanguage)
    ? languages
    : [defaultLanguage, ...languages]

  const handleClear = () => {
    setWord('')
    setTranslation('')
    setContextNote('')
    inputRef.current?.focus()
  }

  return (
    <aside
    className={`w-full lg:w-80 shrink-0 bg-card rounded-xl border border-primary/20 shadow-2xl p-5 h-fit animate-in fade-in ${
      position === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
    } duration-300`}>
      <div className="flex items-start justify-between gap-2 mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <BookMarked className="h-4 w-4 text-primary" />
          Add Vocabulary Word
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
          Word
        </Label>
        <div className="relative">
          <AutoGrowTextarea
            ref={inputRef}
            placeholder="e.g. hund"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && canSave) {
                e.preventDefault()
                handleSave()
              }
            }}
            className="bg-muted/30 focus-visible:ring-primary/30 pr-8"
          />
          <button
            type="button"
            title="Listen"
            aria-label="Listen to this word"
            disabled={!word.trim()}
            onClick={() =>
              speakWord(word, wordLang).catch(() => toast.error('Could not play audio'))
            }
            className="absolute right-3 top-3 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors">
            <Volume2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-2 mt-3">
        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Translation
        </Label>
        <div className="relative">
          <AutoGrowTextarea
            placeholder="e.g. dog"
            value={translation}
            onChange={(e) => {
              markUserEdit()
              setTranslation(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && canSave) {
                e.preventDefault()
                handleSave()
              }
            }}
            className="bg-muted/30 focus-visible:ring-primary/30 pr-8"
          />
          {translating && (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {error && !translating && (
          <p className="text-xs text-destructive mt-1">{error} - type the translation manually.</p>
        )}
      </div>
      <div className="space-y-2 mt-3">
        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Language
        </Label>
        <Select value={wordLang} onValueChange={setWordLang}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 mt-3">
        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Context Note (optional)
        </Label>
        <AutoGrowTextarea
          placeholder="Where you encountered this word"
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          className="bg-muted/30 focus-visible:ring-primary/30"
        />
      </div>
      <div className="flex gap-2 mt-4">
        <Button
          variant="ghost"
          onClick={handleClear}
          disabled={!word.trim() && !translation.trim() && !contextNote.trim()}
          className="text-muted-foreground hover:text-foreground shrink-0">
          Clear
        </Button>
        <Button
          onClick={handleSave}
          disabled={!canSave || addWord.isPending}
          className="flex-1 transition-all shadow-md hover:shadow-lg hover:shadow-primary/25">
          {addWord.isPending ? 'Saving…' : 'Save Word'}
        </Button>
      </div>
    </aside>
  )
}

export default AddWordPanel