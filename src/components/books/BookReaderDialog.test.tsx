import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import BookReaderDialog from '@/components/books/BookReaderDialog'
import type { GutendexBook } from '@/lib/gutendex'

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn().mockResolvedValue([]) },
  vocabularyDb: { insert: vi.fn().mockResolvedValue(undefined) },
}))

const book: GutendexBook = {
  id: 62215,
  title: 'Le Fantôme de l’Opéra',
  authors: [{ name: 'Leroux, Gaston', birth_year: 1868, death_year: 1927 }],
  formats: {
    'text/plain; charset=utf-8': 'https://www.gutenberg.org/cache/epub/62215/pg62215.txt',
  },
  languages: ['fr'],
  download_count: 101041,
}

const SAMPLE_TEXT =
  'The Project Gutenberg eBook header\n*** START OF THE PROJECT GUTENBERG EBOOK LE FANTÔME DE L’OPÉRA ***\n\nCHAPITRE PREMIER\n\nLe fantôme existait.\n\n*** END OF THE PROJECT GUTENBERG EBOOK LE FANTÔME DE L’OPÉRA ***'

const MULTI_CHAPTER_TEXT =
  '*** START OF THE PROJECT GUTENBERG EBOOK ***\n\nCHAPITRE PREMIER\n\nLe fantôme existait.\n\nCHAPITRE II\n\nOn ne le croyait pas.\n\n*** END OF THE PROJECT GUTENBERG EBOOK ***'

function stubFetch(value: unknown) {
  const fn = vi.fn().mockResolvedValue(value)
  vi.stubGlobal('fetch', fn)
  return fn
}

const renderDialog = (overrides: Partial<GutendexBook> = {}, onClose = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <BookReaderDialog book={{ ...book, ...overrides }} onClose={onClose} />
    </QueryClientProvider>
  )
}

describe('BookReaderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the book text through the proxy and renders the body', async () => {
    const fn = stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
    expect(fn.mock.calls[0][0]).toBe('/gutenberg/cache/epub/62215/pg62215.txt')
    expect(screen.getByText('Le Fantôme de l’Opéra')).toBeInTheDocument()
    expect(screen.getByText('Gaston Leroux')).toBeInTheDocument()
  })

  it('renders chapter headings with emphasis', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const heading = await screen.findByText('CHAPITRE PREMIER')
    expect(heading.tagName).toBe('P')
    expect(heading.className).toContain('text-lg')
  })

  it('shows an error with a retry when the fetch fails', async () => {
    stubFetch({ ok: false, status: 404 })
    renderDialog()

    expect(await screen.findByRole('alert')).toHaveTextContent(/Book text request failed/)

    const fn = stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
    expect(fn).toHaveBeenCalled()
  })

  it('explains when the book has no readable text', async () => {
    stubFetch({ ok: true, text: async () => '' })
    renderDialog({ formats: {} })

    expect(
      await screen.findByText('No readable text is available for this book.')
    ).toBeInTheDocument()
  })

  it('opens the vocab form with the selected word when text is selected', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    window.getSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      anchorNode: paragraph,
      toString: () => 'fantôme',
      removeAllRanges: vi.fn(),
    } as unknown as Selection)

    fireEvent.mouseUp(paragraph)

    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme')
    )
  })

  it('opens the vocab form from a touch-style selectionchange', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    window.getSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      anchorNode: paragraph,
      toString: () => 'fantôme',
      removeAllRanges: vi.fn(),
    } as unknown as Selection)

    fireEvent(document, new Event('selectionchange'))

    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme')
    )
  })

  it('paginates chapters with prev and next navigation', async () => {
    stubFetch({ ok: true, text: async () => MULTI_CHAPTER_TEXT })
    renderDialog()

    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
    expect(screen.queryByText('On ne le croyait pas.')).toBeNull()
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    expect(await screen.findByText('On ne le croyait pas.')).toBeInTheDocument()
    expect(screen.queryByText('Le fantôme existait.')).toBeNull()
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Prev/ }))
    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
  })

  it('opens the reader with a single close control', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
    // The shared DialogContent renders its own close button; the reader also places one in
    // the header, and two overlapping X icons in the same corner are not a usable control.
    expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1)
  })

  it('closes the reader from its close button', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    const onClose = vi.fn()
    renderDialog({}, onClose)

    fireEvent.click(await screen.findByRole('button', { name: 'Close reader' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('advances pages with the right arrow key', async () => {
    stubFetch({ ok: true, text: async () => MULTI_CHAPTER_TEXT })
    renderDialog()

    await screen.findByText('Le fantôme existait.')
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(await screen.findByText('On ne le croyait pas.')).toBeInTheDocument()
  })
})