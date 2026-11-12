import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import LessonReaderDialog from '@/components/LessonReaderDialog'
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

const renderReader = (lesson: NestedLesson, onClose = vi.fn()) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  render(
    <QueryClientProvider client={client}>
      <LessonReaderDialog lesson={lesson} initialPartId="p1" onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

describe('LessonReaderDialog', () => {
  it('renders the lesson and its initial part', () => {
    renderReader(makeLesson())

    expect(screen.getAllByText('Unit 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Part 1 of 2')).toBeInTheDocument()
    expect(screen.getAllByText('First part text').length).toBeGreaterThan(1)
  })

  it('switches to another part from the parts rail', () => {
    renderReader(makeLesson())

    fireEvent.click(screen.getAllByText('Part 2')[0])

    expect(screen.getByText('Part 2 of 2')).toBeInTheDocument()
  })

  it('does not close on Escape', () => {
    const onClose = renderReader(makeLesson())

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getAllByText('Unit 1').length).toBeGreaterThan(0)
  })

  it('closes from the Close button', () => {
    const onClose = renderReader(makeLesson())

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
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
