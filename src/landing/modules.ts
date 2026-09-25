import { BookMarked, BookOpen, Film, Table2, Zap } from 'lucide-react'
import type { LandingModule } from './types'

/**
 * Every card points at a page that exists today. Conjugation and grammar deliberately
 * share /lessons: conjugation is a `table` block inside a lesson, grammar is lesson text
 * parts. They get distinct copy so the landing page can describe both honestly.
 */
export const landingModules: LandingModule[] = [
  {
    id: 'vocab',
    title: 'Vocabulary Banks',
    description:
      'Every word you meet gets a home: your own phrasing, the sentence it came from, and a spaced-repetition schedule that decides when you see it again.',
    icon: BookOpen,
    to: '/vocab',
    cta: 'Open the bank',
  },
  {
    id: 'quizzes',
    title: 'Flashcard Quizzes',
    description:
      'A drill that only shows what is actually due. Grade yourself fail, hard, good or easy and the next interval is recalculated on the spot.',
    icon: Zap,
    to: '/quiz',
    cta: 'Start drilling',
  },
  {
    id: 'conjugation',
    title: 'Verb Conjugation',
    description:
      'Conjugation tables laid out as tense columns and verb rows, kept as editable lesson blocks so new verbs slot in as a row rather than a rewrite.',
    icon: Table2,
    to: '/lessons',
    cta: 'See the tables',
  },
  {
    id: 'grammar',
    title: 'Grammar Guides',
    description:
      'The rules the tables assume, written as structured lesson parts — headings, prose and colour, sitting right beside the examples.',
    icon: BookMarked,
    to: '/lessons',
    cta: 'Read the guides',
  },
  {
    id: 'study-rooms',
    title: 'Video Study Rooms',
    description:
      'Play a lesson and work inside it: pause to screenshot, sketch over the frame, and send any word straight to the bank from the sentence you are reading.',
    icon: Film,
    to: '/dashboard',
    cta: 'Open a room',
  },
]
