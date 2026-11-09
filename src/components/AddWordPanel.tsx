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
import { BookMarked, Loader2, Sparkles, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAutoTranslate } from '@/hooks/useAutoTranslate'
import { speakWord } from '@/lib/tts'
import { openAiTutor, useRegisterAiTutor } from '@/lib/aiTutor'
import type { PanelPosition } from '@/components/NoteEditor'

/** Translation targets offered by the form. English stays the default. */
const TRANSLATION_TARGETS = [
  { short: 'EN', value: 'English' },
  { short: 'AR', value: 'Arabic' },
] as const

interface AddWordPanelProps {
  defaultLanguage: string
  onClose: () => void
  position?: PanelPosition
  initialWord?: string
  initialContext?: string
  onSaved?: () => void
  /** Optional video transport row shown above the fields. */
  videoControls?: ReactNode
  /** Tailwind width class for the panel on large screens. */
  widthClassName?: string
}

const AddWordPanel = ({
  defaultLanguage,
  onClose,
  position = 'left',
  initialWord,
  initialContext,
  onSaved,
  videoControls,
  widthClassName = 'lg:w-80',
}: AddWordPanelProps) => {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const savingRef = useRef(false)
  const [word, setWord] = useState((initialWord ?? '').toLowerCase())
  const [translation, setTranslation] = useState('')
  const [contextNote, setContextNote] = useState(initialContext ?? '')
  const [wordLang, setWordLang] = useState(defaultLanguage)
  const [translationLanguage, setTranslationLanguage] = useState('English')

  const { translating, markUserEdit, error } = useAutoTranslate(
    word,
    wordLang,
    translation,
    setTranslation,
    { to: translationLanguage },
  )

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })

  useEffect(() => {
    setWordLang(defaultLanguage)
  }, [defaultLanguage])

  useEffect(() => {
    setWord((initialWord ?? '').toLowerCase())
    setTranslation('')
    setContextNote(initialContext ?? '')
  }, [initialWord, initialContext])

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
      onSaved?.()
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

  const appendToContext = (text: string) => {
    setContextNote((prev) => {
      if (!prev.trim()) return text
      return `${prev.replace(/\s+$/, '')}\n\n${text}`
    })
    toast.success('Added to context')
  }

  // While this form is open it is the most specific Ask AI context, so the
  // panel reads the word, target language, and note the learner is editing.
  useRegisterAiTutor({
    context: {
      word,
      translation,
      language: wordLang,
      answerLanguage: translationLanguage,
      note: contextNote,
    },
    onAddToContext: appendToContext,
  })

  return (
    <aside
    className={`flex max-h-[calc(100dvh-5rem)] w-full ${widthClassName} shrink-0 flex-col overflow-hidden bg-card rounded-xl border border-primary/20 shadow-2xl p-5 animate-in fade-in ${
      position === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
    } duration-300`}>
      <div className="flex items-start justify-between gap-2 mb-4 shrink-0">
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
      {videoControls ? <div className="mb-3 shrink-0">{videoControls}</div> : null}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Word
        </Label>
        <div className="relative">
          <AutoGrowTextarea
            ref={inputRef}
            placeholder="e.g. hund"
            value={word}
            onChange={(e) => setWord(e.target.value.toLowerCase())}
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
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Translation
          </Label>
          <div
            role="group"
            aria-label="Translation language"
            className="flex items-center gap-0.5 rounded-md border border-border/60 p-0.5">
            {TRANSLATION_TARGETS.map((target) => (
              <button
                key={target.value}
                type="button"
                title={`Translate to ${target.value}`}
                aria-label={`Translate to ${target.value}`}
                aria-pressed={translationLanguage === target.value}
                onClick={() => {
                  if (target.value === translationLanguage) return
                  setTranslationLanguage(target.value)
                  setTranslation('')
                }}
                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  translationLanguage === target.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}>
                {target.short}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <AutoGrowTextarea
            placeholder={translationLanguage === 'Arabic' ? 'e.g. كلب' : 'e.g. dog'}
            dir={translationLanguage === 'Arabic' ? 'rtl' : 'ltr'}
            value={translation}
            onChange={(e) => {
              markUserEdit()
              setTranslation(e.target.value.toLowerCase())
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
      <div className="space-y-2">
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
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Context Note (optional)
          </Label>
          <button
            type="button"
            aria-label="Ask AI about this word"
            onClick={openAiTutor}
            className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
            <Sparkles className="h-3 w-3" />
            Ask AI
          </button>
        </div>
        <AutoGrowTextarea
          placeholder="Where you encountered this word"
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          className="bg-muted/30 focus-visible:ring-primary/30"
        />
      </div>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-border/40 shrink-0">
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