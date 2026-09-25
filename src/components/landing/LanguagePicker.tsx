import { getLangDotClass } from '@/lib/langColors'
import { landingLanguages } from '@/landing/languages'
import { cn } from '@/lib/utils'

interface LanguagePickerProps {
  /** The database `languages.name` currently chosen, or null before a choice is made. */
  value: string | null
  onChange: (name: string) => void
}

export const LanguagePicker = ({ value, onChange }: LanguagePickerProps) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a language">
    {landingLanguages.map((language) => {
      const active = language.name === value

      return (
        <button
          key={language.slug}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(language.name)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            active
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/40 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
          )}>
          <span className={cn('h-2 w-2 rounded-full', getLangDotClass(language.name))} />
          {language.name}
        </button>
      )
    })}
  </div>
)
