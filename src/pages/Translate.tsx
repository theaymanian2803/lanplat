import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, BookMarked, Check, Copy, Languages as LanguagesIcon, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { languagesDb, vocabularyDb } from '@/integrations/turso/db'
import { getLangDotClass } from '@/lib/langColors'
import { getTargetLanguage } from '@/lib/targetLanguage'
import { translateWord } from '@/lib/translate'

const LANGUAGES = ['English', 'Danish', 'Spanish', 'Japanese', 'French', 'Swedish']
const DEBOUNCE_MS = 600

const Translate = () => {
  const queryClient = useQueryClient()
  const stored = getTargetLanguage()
  const initialTo =
    stored && stored !== 'English' && LANGUAGES.includes(stored) ? stored : 'Danish'

  const [from, setFrom] = useState('English')
  const [to, setTo] = useState(initialTo)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [saveWord, setSaveWord] = useState('')
  const [saveTranslation, setSaveTranslation] = useState('')
  const [saveLanguage, setSaveLanguage] = useState('')

  useEffect(() => {
    const text = input.trim()
    if (!text) {
      setTranslating(false)
      setError(null)
      setOutput('')
      return
    }
    if (from === to) {
      setTranslating(false)
      setError(null)
      setOutput('')
      return
    }

    let cancelled = false
    const requestId = ++requestRef.current
    const handle = setTimeout(() => {
      setTranslating(true)
      setError(null)
      translateWord(text, from, to)
        .then((result) => {
          if (cancelled || requestId !== requestRef.current) return
          setOutput(result)
        })
        .catch(() => {
          if (cancelled || requestId !== requestRef.current) return
          setError('Translation is unavailable right now')
        })
        .finally(() => {
          if (!cancelled && requestId === requestRef.current) setTranslating(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [input, from, to])

  const { data: dbLanguages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })

  const vocabLanguageOptions = [...new Set([...LANGUAGES, ...dbLanguages])]

  const handleSwap = () => {
    setFrom(to)
    setTo(from)
    setOutput('')
    setError(null)
  }

  const handleOpenVocab = () => {
    setSaveWord(output.toLowerCase())
    setSaveTranslation(input.trim())
    setSaveLanguage(to)
    setDialogOpen(true)
  }

  const saveToVocab = useMutation({
    mutationFn: () =>
      vocabularyDb.insert({
        language: saveLanguage,
        word: saveWord,
        translation: saveTranslation,
        context_note: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] })
      setDialogOpen(false)
      toast.success('Word saved to Vocab Bank!')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save word'),
  })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output)
    toast.success('Copied to clipboard')
  }

  const languageOptions = (value: string, onChange: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((language) => (
          <SelectItem key={language} value={language} className="gap-2">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${getLangDotClass(language)}`} />
              {language}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const canSave = !!saveWord.trim() && !!saveTranslation.trim() && !!saveLanguage

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3">
          <LanguagesIcon className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">Translate</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Translate between any of the languages you study — English, Danish, Spanish,
          Japanese, French and Swedish — without leaving the vault. It translates as you
          type.
        </p>

        <Card className="mt-6">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  From
                </p>
                {languageOptions(from, setFrom, 'Source language')}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mt-5 h-9 w-9"
                onClick={handleSwap}
                aria-label="Swap languages"
                title="Swap languages">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
              <div>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  To
                </p>
                {languageOptions(to, setTo, 'Target language')}
              </div>
            </div>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or paste text to translate…"
              rows={4}
              className="resize-none"
            />

            <div className="flex items-center gap-3">
              {translating ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Translating…
                </p>
              ) : null}
              {!translating && error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {!translating && !error && input.trim() && from === to ? (
                <p className="text-sm text-muted-foreground">Choose two different languages</p>
              ) : null}
              {!translating && !error && input.trim() && from !== to && !output ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <Check className="h-3.5 w-3.5" />
                  Translates automatically as you type.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {output ? (
          <Card className="mt-4">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {from} → {to}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 font-semibold"
                    onClick={handleOpenVocab}>
                    <BookMarked className="h-3.5 w-3.5" />
                    Add to Vocab Bank
                  </Button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">{output}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Vocab Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label
                htmlFor="vocab-word"
                className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Word
              </Label>
              <Input
                id="vocab-word"
                value={saveWord}
                onChange={(e) => setSaveWord(e.target.value.toLowerCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="vocab-translation"
                className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Translation
              </Label>
              <Input
                id="vocab-translation"
                value={saveTranslation}
                onChange={(e) => setSaveTranslation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Language
              </Label>
              <Select value={saveLanguage} onValueChange={setSaveLanguage}>
                <SelectTrigger aria-label="Vocab language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vocabLanguageOptions.map((language) => (
                    <SelectItem key={language} value={language}>
                      {language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveToVocab.mutate()}
              disabled={!canSave || saveToVocab.isPending}
              className="gap-2 font-semibold">
              {saveToVocab.isPending ? 'Saving…' : 'Save Word'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default Translate