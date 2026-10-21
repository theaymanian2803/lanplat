import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, BookMarked, Check, Copy, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
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
      setInput('')
      setOutput('')
      setError(null)
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
      <SelectTrigger className="w-full sm:w-40" aria-label={label}>
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
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.035em]">
              Translate
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Translate between the languages you study, then send the result straight into the
              vault with its source sentence.
            </p>
          </div>
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {languageOptions(from, setFrom, 'Source language')}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={handleSwap}
              aria-label="Swap languages"
              title="Swap languages">
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
            {languageOptions(to, setTo, 'Target language')}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel-enamel rounded-sm p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="mono-label text-ink/75">From · {from}</span>
              <span className="mono-label text-ink/65">{input.trim().length} chars</span>
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or paste text to translate…"
              rows={9}
              className="mt-2 min-h-[220px] resize-none border-ink/20 bg-transparent text-[17px] leading-relaxed text-ink placeholder:text-ink/65 focus-visible:ring-ink/30"
            />
            <div className="mt-2 min-h-[24px]">
              {translating ? (
                <p className="flex items-center gap-2 text-sm text-ink/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Translating…
                </p>
              ) : error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : input.trim() && from === to ? (
                <p className="text-sm text-ink/60">Choose two different languages</p>
              ) : input.trim() && !output ? (
                <p className="flex items-center gap-1.5 text-xs text-ink/75">
                  <Check className="h-3.5 w-3.5" />
                  Translates automatically as you type.
                </p>
              ) : (
                <p className="text-xs text-ink/70">
                  Select a word and its sentence works better as a saved card.
                </p>
              )}
            </div>
          </section>

          <section className="flex min-h-[320px] flex-col rounded-sm border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="mono-label text-muted-foreground">To · {to}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={handleCopy}
                  disabled={!output}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 font-semibold"
                  onClick={handleOpenVocab}
                  disabled={!output}>
                  <BookMarked className="h-3.5 w-3.5" />
                  Add to Vocab Bank
                </Button>
              </div>
            </div>

            <div className="flex flex-1 items-center py-6">
              {output ? (
                <p className="whitespace-pre-wrap text-[clamp(1.7rem,2.8vw,2.6rem)] font-semibold leading-[1.12] tracking-[-0.025em]">
                  {output}
                </p>
              ) : (
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  The translation appears here as you type. Save it with the original sentence so
                  the card has context when it comes back in review.
                </p>
              )}
            </div>

            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="mono-label text-muted-foreground/70">
                {from} → {to}
              </span>
              <span className="mono-label text-muted-foreground/50">
                {output ? `${output.trim().length} chars` : 'Waiting for input'}
              </span>
            </div>
          </section>
        </div>
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
                className="mono-label text-muted-foreground">
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
                className="mono-label text-muted-foreground">
                Translation
              </Label>
              <Input
                id="vocab-translation"
                value={saveTranslation}
                onChange={(e) => setSaveTranslation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="mono-label text-muted-foreground">Language</Label>
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
