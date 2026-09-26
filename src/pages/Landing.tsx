import { useState } from 'react'
import { Check } from 'lucide-react'

import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { LanguagePicker } from '@/components/landing/LanguagePicker'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks'
import { LandingNavbar } from '@/components/landing/LandingNavbar'
import { landingLanguages } from '@/landing/languages'
import { getTargetLanguage, setTargetLanguage } from '@/lib/targetLanguage'

const STAT_LABELS: { key: 'words' | 'decks' | 'lessons'; label: string }[] = [
  { key: 'words', label: 'Words banked' },
  { key: 'decks', label: 'Decks' },
  { key: 'lessons', label: 'Lessons' },
]

/**
 * The public face of the app. Reads nothing but the static manifest, so it paints without
 * a database call. The language choice is persisted here, before the visitor authenticates,
 * so the app can open pre-filtered.
 */
const Landing = () => {
  const [language, setLanguage] = useState<string | null>(() => getTargetLanguage())

  const handleLanguage = (name: string) => {
    setTargetLanguage(name)
    setLanguage(name)
  }

  // A stored name the manifest does not carry is ignored rather than rendered.
  const active = landingLanguages.find((entry) => entry.name === language) ?? null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNavbar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingHero language={active} />

          <section id="languages" className="scroll-mt-20 border-t border-border/40 py-16">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Pick your language
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Your choice follows you in
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Choose a language here and the vault opens already filtered to it — your media,
              your vocabulary and your drills, with nothing else in the way.
            </p>

            <div className="mt-8">
              <LanguagePicker value={language} onChange={handleLanguage} />
            </div>

            {active ? (
              <div className="mt-10">
                <div className="grid gap-4 sm:grid-cols-3">
                  {STAT_LABELS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-border/40 bg-card p-5">
                      <p className="font-display text-3xl font-semibold tracking-tight text-primary">
                        {active.stats[key].toLocaleString()}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  Illustrative figures, not your own counts
                </p>
                <ul className="mt-6 space-y-3">
                  {active.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section id="modules" className="scroll-mt-20 border-t border-border/40 py-16">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Everything inside
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Five ways in, one vault
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Jump straight into whichever part of learning you came for.
            </p>
            <div className="mt-10">
              <FeatureGrid languageName={active?.name ?? null} />
            </div>
          </section>

          <LandingHowItWorks />
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}

export default Landing
