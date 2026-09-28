import { describe, expect, it } from 'vitest'
import { landingLanguages } from './languages'
import { landingModules } from './modules'
import { getLangBadgeClasses, getLangDotClass } from '@/lib/langColors'

/** The only names langColors.ts can colour; anything else silently falls back to zinc. */
const COLOURED = ['Danish', 'French', 'Japanese', 'Spanish', 'Swedish']

describe('landing manifest', () => {
  it('ships a language for every colour the app can render', () => {
    expect(landingLanguages.map((l) => l.name).sort()).toEqual([...COLOURED].sort())
  })

  it('gives every language a distinct slug', () => {
    const slugs = landingLanguages.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('fills in every field the landing page renders', () => {
    for (const language of landingLanguages) {
      expect(language.slug.trim()).not.toBe('')
      expect(language.name.trim()).not.toBe('')
      expect(language.tagline.trim()).not.toBe('')
      expect(language.highlights.length).toBeGreaterThan(0)
      for (const highlight of language.highlights) expect(highlight.trim()).not.toBe('')
      expect(Number.isFinite(language.stats.words)).toBe(true)
      expect(Number.isFinite(language.stats.decks)).toBe(true)
      expect(Number.isFinite(language.stats.lessons)).toBe(true)
    }
  })

  it('gives every language real colour rather than the fallback', () => {
    for (const language of landingLanguages) {
      expect(getLangDotClass(language.name)).not.toBe('bg-zinc-400')
      expect(getLangBadgeClasses(language.name)).not.toContain('zinc')
    }
  })

  it('routes every module at a page that exists', () => {
    const real = ['/dashboard', '/vocab', '/quiz', '/lessons', '/languages', '/video/:id']
    for (const module of landingModules) expect(real).toContain(module.to)
  })

  it('gives every module an id, a title, a description and a call to action', () => {
    expect(new Set(landingModules.map((m) => m.id)).size).toBe(landingModules.length)
    for (const module of landingModules) {
      expect(module.title.trim()).not.toBe('')
      expect(module.description.trim()).not.toBe('')
      expect(module.cta.trim()).not.toBe('')
    }
  })

  it('covers the five modules the landing page advertises', () => {
    expect(landingModules.map((m) => m.id)).toEqual([
      'vocab',
      'quizzes',
      'conjugation',
      'grammar',
      'study-rooms',
    ])
  })
})
