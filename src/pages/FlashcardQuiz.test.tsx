import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import FlashcardQuiz from './FlashcardQuiz'
import { vocabularyDb } from '@/integrations/turso/db'
import type { VocabWord } from '@/integrations/turso/types'

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn().mockResolvedValue(['Arabic', 'Danish', 'Spanish']) },
  vocabularyDb: {
    listDue: vi.fn().mockResolvedValue([]),
    updateSrs: vi.fn().mockResolvedValue(undefined),
  },
}))

const word = (
  id: string,
  language: string,
  text: string,
  translation: string
): VocabWord => ({
  id,
  user_id: 'local-user',
  language,
  word: text,
  translation,
  context_note: null,
  created_at: '2026-01-01T00:00:00.000Z',
  mastery_level: 0,
  next_review_date: '2026-01-01T00:00:00.000Z',
})

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FlashcardQuiz />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('FlashcardQuiz', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(vocabularyDb.listDue).mockResolvedValue([
      word('1', 'Danish', 'hund', 'dog'),
      word('2', 'Spanish', 'perro', 'dog'),
    ])
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('filters due cards to the chosen language', async () => {
    renderPage()

    expect(await screen.findByText('hund')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: 'Test language' }))
    fireEvent.click(await screen.findByRole('option', { name: /Danish/ }))

    expect(await screen.findByText('hund')).toBeInTheDocument()
    expect(screen.getByText('1 / 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: 'Test language' }))
    fireEvent.click(await screen.findByRole('option', { name: /Spanish/ }))

    expect(await screen.findByText('perro')).toBeInTheDocument()
    expect(screen.queryByText('hund')).toBeNull()
  })

  it('defaults to the stored learning language', async () => {
    localStorage.setItem('lingovault_target_language', 'Spanish')
    renderPage()

    expect(await screen.findByText('perro')).toBeInTheDocument()
    expect(screen.queryByText('hund')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Test language' })).toHaveTextContent('Spanish')
  })

  it('explains when the chosen language has nothing due', async () => {
    localStorage.setItem('lingovault_target_language', 'Arabic')
    renderPage()

    expect(
      await screen.findByText('No Arabic words are due for review right now.')
    ).toBeInTheDocument()
  })
})
