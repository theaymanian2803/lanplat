import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getLangDotClass } from '@/lib/langColors'
import type { LandingLanguage } from '@/landing/types'

interface LandingHeroProps {
  /** The language the visitor already chose, or null on a first visit. */
  language: LandingLanguage | null
}

const WORKING_LANGUAGES = ['Danish', 'Japanese', 'Spanish', 'French', 'Swedish']

export const LandingHero = ({ language }: LandingHeroProps) => (
  <section className="py-8 sm:py-12">
    <div className="panel-enamel rounded-sm px-5 py-10 sm:px-10 sm:py-14">
      <h1 className="max-w-4xl text-[clamp(2.4rem,5.6vw,4.4rem)] font-extrabold leading-[0.98] tracking-[-0.045em]">
        A quiet place to <span className="text-primary">actually learn</span> a language
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink/70 sm:text-lg">
        Watch a lesson, pull the words out as you meet them, and let spaced repetition decide
        what you see next. Everything you collect lives in one vault.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button asChild size="lg" className="gap-2 font-semibold">
          <Link to="/dashboard">
            Enter the vault
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="border-ink/25 bg-transparent text-ink hover:bg-ink/10 hover:text-ink">
          <a href="#modules">Browse the modules</a>
        </Button>
      </div>
      <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink/15 pt-4">
        <span className="mono-label text-ink/75">Working languages</span>
        {WORKING_LANGUAGES.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 rounded-sm border border-ink/20 px-2 py-1 text-xs text-ink/75">
            <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(name)}`} />
            {name}
          </span>
        ))}
        {language ? (
          <span className="text-sm text-ink/75">
            You were on {language.name} — {language.tagline}
          </span>
        ) : null}
      </div>
    </div>
  </section>
)
