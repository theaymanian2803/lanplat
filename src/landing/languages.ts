import type { LandingLanguage } from './types'

/**
 * Curated marketing copy for the public landing page. The `stats` figures are hand
 * maintained snapshots, NOT live query results — refresh them by editing this file. The
 * database remains the source of truth for the app; a language added at runtime through
 * /languages will not appear here until it is added below.
 */
export const landingLanguages: LandingLanguage[] = [
  {
    slug: 'danish',
    name: 'Danish',
    tagline: 'Close to the ground, quick on the ear once you stop translating.',
    highlights: [
      'Vowel endings that finally stop surprising you',
      'Compound nouns broken apart as you meet them',
      'Street interviews you can follow without a transcript',
    ],
    stats: { words: 1240, decks: 18, lessons: 12 },
  },
  {
    slug: 'japanese',
    name: 'Japanese',
    tagline: 'Three scripts, one rhythm, and a dictionary that never sleeps.',
    highlights: [
      'Kanji tracked beside the kana that carry them',
      'Pitch accent marked as you hear it',
      'Keigo and register side by side',
    ],
    stats: { words: 860, decks: 11, lessons: 7 },
  },
  {
    slug: 'spanish',
    name: 'Spanish',
    tagline: 'The fastest route from listening to holding an actual conversation.',
    highlights: [
      'Subjunctive rules gathered into one page',
      'Ser and estar contrasted until it is boring',
      'Full-length dramas with notes at every turn',
    ],
    stats: { words: 1520, decks: 24, lessons: 15 },
  },
  {
    slug: 'french',
    name: 'French',
    tagline: 'A language of contours — the ear learns before the mouth obeys.',
    highlights: [
      'Liaisons marked the moment you meet them',
      'Passé composé and imparfait side by side',
      'Everyday conversations you can actually keep up with',
    ],
    stats: { words: 980, decks: 14, lessons: 11 },
  },
  {
    slug: 'swedish',
    name: 'Swedish',
    tagline: 'Melody first, grammar second — a language that rewards just listening.',
    highlights: [
      'Word melody charted as you hear it',
      'En and ett endings without the guesswork',
      'Street-level Swedish, subtitled and noteable',
    ],
    stats: { words: 640, decks: 9, lessons: 8 },
  },
]
