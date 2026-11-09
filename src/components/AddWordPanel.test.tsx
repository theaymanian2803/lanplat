import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddWordPanel from '@/components/AddWordPanel'
import AiTutorPanel from '@/components/ai/AiTutorPanel'
import { askTutor } from '@/lib/aiChat'
import { resetAiTutor } from '@/lib/aiTutor'
import { vocabularyDb } from '@/integrations/turso/db'

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn().mockResolvedValue(['Danish']) },
  vocabularyDb: { insert: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/hooks/useAutoTranslate', () => ({
  useAutoTranslate: () => ({ translating: false, markUserEdit: vi.fn(), error: null }),
}))

vi.mock('@/lib/tts', () => ({ speakWord: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/lib/aiChat', () => ({
  askTutor: vi.fn().mockResolvedValue('A long explanation.'),
}))

function renderPanel(initialWord?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const tree = (word?: string) => (
    <QueryClientProvider client={client}>
      <AddWordPanel
        defaultLanguage="Danish"
        onClose={onClose}
        onSaved={onSaved}
        initialWord={word}
      />
    </QueryClientProvider>
  )
  const view = render(tree(initialWord))
  return { ...view, onClose, onSaved, showWord: (word?: string) => view.rerender(tree(word)) }
}

function renderPanelWithAi(initialWord?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AddWordPanel
        defaultLanguage="Danish"
        onClose={vi.fn()}
        initialWord={initialWord}
      />
      <AiTutorPanel />
    </QueryClientProvider>
  )
}

describe('AddWordPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAiTutor()
    vi.mocked(vocabularyDb.insert).mockResolvedValue(undefined)
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

  it('shows the supplied video controls at the top of the form', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AddWordPanel
          defaultLanguage="Danish"
          onClose={vi.fn()}
          videoControls={<button type="button">Play video</button>}
        />
      </QueryClientProvider>
    )

    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument()
  })

  it('clears its fields after saving and stays open for the next word', async () => {
    const { onSaved } = renderPanel('hund')
    fireEvent.change(screen.getByPlaceholderText('e.g. dog'), { target: { value: 'dog' } })
    fireEvent.change(screen.getByPlaceholderText('Where you encountered this word'), {
      target: { value: 'chapter 1' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save Word' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('')
    expect(screen.getByPlaceholderText('e.g. dog')).toHaveValue('')
    expect(screen.getByPlaceholderText('Where you encountered this word')).toHaveValue('')
    expect(screen.getByText('Add Vocabulary Word')).toBeInTheDocument()
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

  it('defaults to translating into English', () => {
    renderPanel('hund')

    expect(screen.getByRole('button', { name: 'Translate to English' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Translate to Arabic' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('switches the translation field to Arabic and clears the old translation', () => {
    renderPanel('hund')
    fireEvent.change(screen.getByPlaceholderText('e.g. dog'), { target: { value: 'dog' } })

    fireEvent.click(screen.getByRole('button', { name: 'Translate to Arabic' }))

    const arabic = screen.getByPlaceholderText('e.g. كلب')
    expect(arabic).toHaveAttribute('dir', 'rtl')
    expect(arabic).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Translate to Arabic' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('opens the global Ask AI panel with the word from the form', async () => {
    renderPanelWithAi('hund')

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI about this word' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ask AI' })).toBeInTheDocument()
    expect(screen.getByText(/About “hund”/)).toBeInTheDocument()
    expect(screen.getByLabelText('Message the AI tutor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explain this word' })).toBeInTheDocument()
  })

  it('sends the live form fields as Ask AI context', async () => {
    renderPanelWithAi('hund')
    fireEvent.change(screen.getByPlaceholderText('e.g. dog'), { target: { value: 'dog' } })
    fireEvent.change(screen.getByPlaceholderText('Where you encountered this word'), {
      target: { value: 'chapter 1' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI about this word' }))
    const input = screen.getByLabelText('Message the AI tutor')
    fireEvent.change(input, { target: { value: 'Explain' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(askTutor).toHaveBeenCalled())
    expect(vi.mocked(askTutor).mock.calls[0][1]).toMatchObject({
      word: 'hund',
      translation: 'dog',
      language: 'Danish',
      answerLanguage: 'English',
      note: 'chapter 1',
    })
  })

  it('appends a global AI answer to the existing context note', async () => {
    renderPanelWithAi('hund')
    fireEvent.change(screen.getByPlaceholderText('Where you encountered this word'), {
      target: { value: 'chapter 1' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI about this word' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Explain this word' }))
    await screen.findByText('A long explanation.')
    fireEvent.click(screen.getByRole('button', { name: 'Add this answer to the context note' }))

    expect(screen.getByPlaceholderText('Where you encountered this word')).toHaveValue(
      'chapter 1\n\nA long explanation.'
    )
  })

  it('appends a second global AI answer with one blank line between them', async () => {
    vi.mocked(askTutor)
      .mockResolvedValueOnce('First answer.')
      .mockResolvedValueOnce('Second answer.')
    renderPanelWithAi('hund')

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI about this word' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Explain this word' }))
    await screen.findByText('First answer.')
    fireEvent.click(screen.getByRole('button', { name: 'Add this answer to the context note' }))

    const input = screen.getByLabelText('Message the AI tutor')
    fireEvent.change(input, { target: { value: 'Another question' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText('Second answer.')

    const addButtons = screen.getAllByRole('button', {
      name: 'Add this answer to the context note',
    })
    fireEvent.click(addButtons[addButtons.length - 1])

    expect(screen.getByPlaceholderText('Where you encountered this word')).toHaveValue(
      'First answer.\n\nSecond answer.'
    )
  })
})
