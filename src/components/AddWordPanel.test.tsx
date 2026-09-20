import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddWordPanel from '@/components/AddWordPanel'
import { vocabularyDb } from '@/integrations/turso/db'

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn().mockResolvedValue(['Danish']) },
  vocabularyDb: { insert: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/hooks/useAutoTranslate', () => ({
  useAutoTranslate: () => ({ translating: false, markUserEdit: vi.fn(), error: null }),
}))

vi.mock('@/lib/tts', () => ({ speakWord: vi.fn().mockResolvedValue(undefined) }))

function renderPanel(initialWord?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = vi.fn()
  const tree = (word?: string) => (
    <QueryClientProvider client={client}>
      <AddWordPanel defaultLanguage="Danish" onClose={onClose} initialWord={word} />
    </QueryClientProvider>
  )
  const view = render(tree(initialWord))
  return { ...view, onClose, showWord: (word?: string) => view.rerender(tree(word)) }
}

describe('AddWordPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('replaces the previous word when a new word is selected', () => {
    const { showWord } = renderPanel('hund')
    const wordInput = screen.getByPlaceholderText('e.g. hund')
    expect(wordInput).toHaveValue('hund')

    showWord('kat')

    expect(wordInput).toHaveValue('kat')
  })

  it('clears the previous translation when a new word is selected', () => {
    const { showWord } = renderPanel('hund')
    const translationInput = screen.getByPlaceholderText('e.g. dog')
    fireEvent.change(translationInput, { target: { value: 'dog' } })
    expect(translationInput).toHaveValue('dog')

    showWord('kat')

    expect(translationInput).toHaveValue('')
  })

  it('clears the previous context note when a new word is selected', () => {
    const { showWord } = renderPanel('hund')
    const contextInput = screen.getByPlaceholderText('Where you encountered this word')
    fireEvent.change(contextInput, { target: { value: 'chapter 1' } })

    showWord('kat')

    expect(contextInput).toHaveValue('')
  })

  it('resets the form when reopened without a word', () => {
    const { showWord } = renderPanel('hund')
    fireEvent.change(screen.getByPlaceholderText('e.g. hund'), { target: { value: 'typed' } })

    showWord(undefined)

    expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('')
  })

  it('disables saving when the fields only contain whitespace', () => {
    renderPanel()
    fireEvent.change(screen.getByPlaceholderText('e.g. hund'), { target: { value: '   ' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. dog'), { target: { value: '   ' } })

    expect(screen.getByRole('button', { name: 'Save Word' })).toBeDisabled()
  })

  it('saves only once when Enter is pressed twice quickly', async () => {
    const insert = vi.mocked(vocabularyDb.insert)
    insert.mockReturnValue(new Promise(() => {}) as Promise<void>)
    renderPanel()
    const wordInput = screen.getByPlaceholderText('e.g. hund')
    const translationInput = screen.getByPlaceholderText('e.g. dog')
    fireEvent.change(wordInput, { target: { value: 'hund' } })
    fireEvent.change(translationInput, { target: { value: 'dog' } })

    fireEvent.keyDown(wordInput, { key: 'Enter' })
    fireEvent.keyDown(wordInput, { key: 'Enter' })

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
  })

  it('lowercases the word and translation as the user types', () => {
    renderPanel()
    const wordInput = screen.getByPlaceholderText('e.g. hund')
    const translationInput = screen.getByPlaceholderText('e.g. dog')

    fireEvent.change(wordInput, { target: { value: 'HUND' } })
    fireEvent.change(translationInput, { target: { value: 'DOG' } })

    expect(wordInput).toHaveValue('hund')
    expect(translationInput).toHaveValue('dog')
  })

  it('lowercases the initial word passed from selection', () => {
    renderPanel('Hund')
    expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('hund')
  })
})
