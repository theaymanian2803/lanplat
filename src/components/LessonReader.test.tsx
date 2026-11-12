import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import LessonReader from '@/components/LessonReader'
import { createBlock, serializeBlocks } from '@/lib/lessonBlocks'
import type { NestedLesson } from '@/lib/lessonTree'
import type { Lesson } from '@/integrations/turso/types'

vi.mock('@/integrations/turso/db', () => ({
  lessonsDb: {
    list: vi.fn().mockResolvedValue([]),
    createPart: vi.fn().mockResolvedValue('new-part'),
    updatePart: vi.fn().mockResolvedValue(undefined),
  },
  languagesDb: { list: vi.fn().mockResolvedValue(['Danish', 'Japanese']) },
  vocabularyDb: { insert: vi.fn().mockResolvedValue(undefined) },
  notesDb: { insert: vi.fn().mockResolvedValue(undefined) },
}))

const lessonRow = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: 'l1',
  user_id: 'u',
  media_type: null,
  media_id: null,
  title: 'Unit 1',
  language: 'Danish',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeLesson = (overrides: Partial<Lesson> = {}): NestedLesson => ({
  ...lessonRow(overrides),
  parts: [
    {
      id: 'p1',
      lesson_id: 'l1',
      user_id: 'u',
      position: 1,
      content: serializeBlocks([createBlock('p', 'First part text')]),
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      lesson_id: 'l1',
      user_id: 'u',
      position: 2,
      content: serializeBlocks([createBlock('p', 'Second part text')]),
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
})

const makeEmptyLesson = (): NestedLesson => ({ ...lessonRow(), parts: [] })

const ReaderHarness = ({ lesson }: { lesson: NestedLesson }) => {
  const [partId, setPartId] = useState(lesson.parts[0]?.id)
  return <LessonReader lesson={lesson} partId={partId} onPartChange={setPartId} />
}

const renderReader = (lesson: NestedLesson) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  render(
    <QueryClientProvider client={client}>
      <ReaderHarness lesson={lesson} />
    </QueryClientProvider>,
  )
}

describe('LessonReader', () => {
  it('renders the lesson and its first part inline, without a dialog', () => {
    renderReader(makeLesson())

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Part 1 of 2')).toBeInTheDocument()
    expect(screen.getAllByText('First part text').length).toBeGreaterThan(1)
  })

  it('switches to another part from the parts rail', () => {
    renderReader(makeLesson())

    fireEvent.click(screen.getAllByText('Part 2')[0])

    expect(screen.getByText('Part 2 of 2')).toBeInTheDocument()
  })

  it('moves between parts with Prev and Next', () => {
    renderReader(makeLesson())

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('Part 2 of 2')).toBeInTheDocument()
  })

  it('shows an empty state when the lesson has no parts', () => {
    renderReader(makeEmptyLesson())

    expect(screen.getByText('This lesson has no parts yet.')).toBeInTheDocument()
  })

  it('hides Add Note for a lesson without video media', () => {
    renderReader(makeLesson())

    expect(screen.queryByTitle('Add Note')).not.toBeInTheDocument()
    expect(screen.getByTitle('Add Vocabulary')).toBeInTheDocument()
    expect(screen.getByTitle('Add Lesson Content')).toBeInTheDocument()
    expect(screen.getByTitle('Pen / Draw')).toBeInTheDocument()
  })

  it('shows Add Note when the lesson is tied to a video', () => {
    renderReader(makeLesson({ media_type: 'video', media_id: 'v1' }))

    expect(screen.getByTitle('Add Note')).toBeInTheDocument()
  })
})
