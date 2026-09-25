import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { languagesDb } from '@/integrations/turso/db'

const ADD_NEW = '__add_new_language__'

interface LanguageSelectProps {
  /** Ties the control to its <Label htmlFor>, so it has an accessible name. */
  id?: string
  languages: string[]
  value: string
  onChange: (language: string) => void
}

/**
 * Lists every language that already exists, with an escape hatch at the bottom that turns
 * the field into a text input for adding one. A name that already exists under different
 * capitalization selects the stored spelling rather than creating a near-duplicate.
 */
export default function LanguageSelect({ id, languages, value, onChange }: LanguageSelectProps) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const typed = draft.trim()
  const existing = languages.find((l) => l.toLowerCase() === typed.toLowerCase())

  const reset = () => {
    setAdding(false)
    setDraft('')
  }

  const addLanguage = useMutation({
    mutationFn: async (name: string) => {
      // The list can be stale, so let the database be the final word on duplicates.
      await languagesDb.add(name)
    },
    onSuccess: (_result, name) => {
      queryClient.invalidateQueries({ queryKey: ['languages'] })
      onChange(name)
      reset()
      toast.success(`"${name}" added`)
    },
    onError: (e) => toast.error(e.message),
  })

  const submit = () => {
    if (!typed) return
    if (existing) {
      onChange(existing)
      reset()
      return
    }
    addLanguage.mutate(typed)
  }

  if (adding) {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={id}
          autoFocus
          placeholder="e.g. Icelandic"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={!typed || addLanguage.isPending}>
          {addLanguage.isPending ? 'Adding…' : 'Add'}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === ADD_NEW) {
          setAdding(true)
          return
        }
        onChange(v)
      }}>
      <SelectTrigger id={id} className="flex-1">
        <SelectValue placeholder="Select a language" />
      </SelectTrigger>
      <SelectContent>
        {languages.map((language) => (
          <SelectItem key={language} value={language}>
            {language}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={ADD_NEW}>+ Add new language</SelectItem>
      </SelectContent>
    </Select>
  )
}
