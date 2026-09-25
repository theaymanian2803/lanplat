import type { LucideIcon } from 'lucide-react'

export interface LandingStats {
  words: number
  decks: number
  lessons: number
}

export interface LandingLanguage {
  /** URL-safe identifier, used as a React key. */
  slug: string
  /**
   * Must be a key in src/lib/langColors.ts — that is what supplies the colour. It is also
   * the exact string written to the database `languages.name` column, so it has to match.
   */
  name: string
  tagline: string
  highlights: string[]
  stats: LandingStats
}

export interface LandingModule {
  id: string
  title: string
  description: string
  icon: LucideIcon
  /** An in-app route. See the manifest test for the list of routes that exist. */
  to: string
  cta: string
}
