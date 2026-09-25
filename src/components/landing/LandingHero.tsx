import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getLangBadgeClasses } from '@/lib/langColors'
import type { LandingLanguage } from '@/landing/types'

interface LandingHeroProps {
  /** The language the visitor already chose, or null on a first visit. */
  language: LandingLanguage | null
}

export const LandingHero = ({ language }: LandingHeroProps) => (
  <section className="flex flex-col items-center py-20 text-center sm:py-28">
    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
      Danish · Japanese · Spanish
    </p>
    <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
      A quiet place to <span className="text-primary">actually learn</span> a language
    </h1>
    <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
      Watch a lesson, pull the words out as you meet them, and let spaced repetition decide
      what you see next. Everything you collect lives in one vault.
    </p>
    <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
      <Button asChild size="lg" className="gap-2 font-semibold">
        <Link to="/dashboard">
          Enter the vault
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <a href="#modules">Browse the modules</a>
      </Button>
    </div>
    {language ? (
      <p className="mt-8 text-sm text-muted-foreground">
        You were working on{' '}
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${getLangBadgeClasses(
            language.name
          )}`}>
          {language.name}
        </span>{' '}
        — {language.tagline}
      </p>
    ) : null}
  </section>
)
