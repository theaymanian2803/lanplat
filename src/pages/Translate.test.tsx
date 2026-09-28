import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import Translate from './Translate'
import { vocabularyDb } from '@/integrations/turso/db'
import { clearTranslateCache } from '@/lib/translate'

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn().mockResolvedValue([]) },
  vocabularyDb: { insert: vi.fn().mockResolvedValue(undefined) },
}))

const googleResponse = [[['hej', 'hi', null, null, 10]], null, 'en', null, null, null, null, []]

const stubFetch = () => {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => googleResponse })
  vi.stubGlobal('fetch', fn)
  return fn
}

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Translate />
    </QueryClientProvider>
  )
}

const typeInput = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/Type or paste text/i), {
    target: { value: text },
  })

const chooseTarget = async (name: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Target language' }))
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

describe('Translate', () => {
  beforeEach(() => {
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    clearTranslateCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('defaults to English as the source and Danish as the target', () => {
    renderPage()

    expect(screen.getByRole('combobox', { name: 'Source language' })).toHaveTextContent('English')
    expect(screen.getByRole('combobox', { name: 'Target language' })).toHaveTextContent('Danish')
  })

  it('defaults the target to the stored learning language', () => {
    localStorage.setItem('lingovault_target_language', 'Swedish')
    renderPage()

    expect(screen.getByRole('combobox', { name: 'Target language' })).toHaveTextContent('Swedish')
  })

  it('translates in real time as the text is typed', async () => {
    const fetchMock = stubFetch()
    renderPage()

    typeInput('hello')

    expect(await screen.findByText('hej', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByText('English → Danish')).toBeInTheDocument()

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('sl=en')
    expect(url).toContain('tl=da')
  })

  it('does not translate when source and target are the same', async () => {
    const fetchMock = stubFetch()
    renderPage()

    await chooseTarget('English')
    typeInput('hello')

    expect(
      await screen.findByText('Choose two different languages', {}, { timeout: 2000 })
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swaps the source and target languages', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Swap languages' }))

    expect(screen.getByRole('combobox', { name: 'Source language' })).toHaveTextContent('Danish')
    expect(screen.getByRole('combobox', { name: 'Target language' })).toHaveTextContent('English')
  })

  it('shows an error when translation is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    renderPage()

    typeInput('hello')

    expect(
      await screen.findByRole('alert', {}, { timeout: 2000 })
    ).toHaveTextContent(/Translation is unavailable/)
  })

  it('opens the vocab dialog pre-filled with the translation and its target language', async () => {
    stubFetch()
    renderPage()

    typeInput('hello')
    await screen.findByText('hej', {}, { timeout: 2000 })

    fireEvent.click(screen.getByRole('button', { name: /Add to Vocab Bank/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Word')).toHaveValue('hej')
    expect(screen.getByLabelText('Translation')).toHaveValue('hello')
    expect(screen.getByRole('combobox', { name: 'Vocab language' })).toHaveTextContent('Danish')
  })

  it('saves the translation into the vocab bank with the chosen language', async () => {
    stubFetch()
    renderPage()

    typeInput('hello')
    await screen.findByText('hej', {}, { timeout: 2000 })

    fireEvent.click(screen.getByRole('button', { name: /Add to Vocab Bank/ }))

    fireEvent.click(screen.getByRole('combobox', { name: 'Vocab language' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Swedish' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Word' }))

    await waitFor(() =>
      expect(vocabularyDb.insert).toHaveBeenCalledWith({
        language: 'Swedish',
        word: 'hej',
        translation: 'hello',
        context_note: null,
      })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})