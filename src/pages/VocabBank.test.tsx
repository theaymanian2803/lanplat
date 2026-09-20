import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VocabBank from '@/pages/VocabBank'
import { vocabularyDb } from '@/integrations/turso/db'
import type { VocabWord } from '@/integrations/turso/types'

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn().mockResolvedValue(['Danish']) },
  vocabularyDb: {
    list: vi.fn(),
    insert: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    updateSrs: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/hooks/useAutoTranslate', () => ({
  useAutoTranslate: () => ({ translating: false, markUserEdit: vi.fn(), error: null }),
}))

vi.mock('@/lib/dictionary', () => ({ openDictionary: vi.fn() }))

vi.mock('jspdf', () => ({
  default: class {
    text() {}
    setFontSize() {}
    setTextColor() {}
    save() {}
  },
}))

vi.mock('jspdf-autotable', () => ({ default: vi.fn() }))

const word = (overrides: Partial<VocabWord> = {}): VocabWord => ({
  id: 'w1',
  user_id: 'u',
  language: 'Danish',
  word: 'hund',
  translation: 'dog',
  context_note: 'seen in chapter 3',
  created_at: '2026-01-01T00:00:00.000Z',
  mastery_level: 0,
  next_review_date: '',
  ...overrides,
})

function renderPage(words: VocabWord[]) {
  vi.mocked(vocabularyDb.list).mockResolvedValue(words)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VocabBank />
    </QueryClientProvider>
  )
}

describe('VocabBank', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens a dialog with the context note when the sticky note icon is clicked', async () => {
    renderPage([word()])

    await waitFor(() => expect(screen.getByText('hund')).toBeInTheDocument())

    const noteButton = screen.getByTitle('View context note')
    fireEvent.click(noteButton)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeVisible()
    expect(screen.getByText('seen in chapter 3')).toBeVisible()
  })

  it('shows an empty state when the word has no context note', async () => {
    renderPage([word({ context_note: null })])

    await waitFor(() => expect(screen.getByText('hund')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('View context note'))

    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByText('No context note for this word.')).toBeVisible()
  })

  it('closes the dialog', async () => {
    renderPage([word()])

    await waitFor(() => expect(screen.getByText('hund')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('View context note'))
    expect(screen.getByRole('dialog')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('opens the edit dialog prefilled with the word details', async () => {
    renderPage([word()])

    await waitFor(() => expect(screen.getByText('hund')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Edit word'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByDisplayValue('hund')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('dog')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('seen in chapter 3')).toBeInTheDocument()
  })

  it('saves edits to the word, translation and context note', async () => {
    renderPage([word()])

    await waitFor(() => expect(screen.getByText('hund')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Edit word'))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByDisplayValue('hund'), { target: { value: 'kat' } })
    fireEvent.change(within(dialog).getByDisplayValue('dog'), { target: { value: 'cat' } })
    fireEvent.change(within(dialog).getByDisplayValue('seen in chapter 3'), { target: { value: 'seen in chapter 5' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(vocabularyDb.update).toHaveBeenCalledWith('w1', {
        word: 'kat',
        translation: 'cat',
        language: 'Danish',
        context_note: 'seen in chapter 5',
      })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('prevents saving an empty word in the edit dialog', async () => {
    renderPage([word()])

    await waitFor(() => expect(screen.getByText('hund')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Edit word'))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByDisplayValue('hund'), { target: { value: '   ' } })

    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('lowercases the word and translation in the add dialog', async () => {
    renderPage([word()])

    await waitFor(() => expect(screen.getByText('hund')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Add Word' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByPlaceholderText('e.g. hund'), { target: { value: 'HUND' } })
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. dog'), { target: { value: 'DOG' } })

    expect(within(dialog).getByPlaceholderText('e.g. hund')).toHaveValue('hund')
    expect(within(dialog).getByPlaceholderText('e.g. dog')).toHaveValue('dog')
  })

  it('lowercases edits in the edit dialog', async () => {
    renderPage([word()])

    await waitFor(() => expect(screen.getByText('hund')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Edit word'))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByDisplayValue('hund'), { target: { value: 'KAT' } })
    fireEvent.change(within(dialog).getByDisplayValue('dog'), { target: { value: 'CAT' } })

    expect(within(dialog).getByDisplayValue('kat')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('cat')).toBeInTheDocument()
  })
})