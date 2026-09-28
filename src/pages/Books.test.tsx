import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import Books from './Books'
import type { GutendexBook } from '@/lib/gutendex'

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const book = (overrides: Partial<GutendexBook> = {}): GutendexBook => ({
  id: 1,
  title: 'Le Fantôme de l’Opéra',
  authors: [{ name: 'Leroux, Gaston', birth_year: 1868, death_year: 1927 }],
  formats: {
    'image/jpeg': 'https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg',
    'application/epub+zip': 'https://www.gutenberg.org/ebooks/1.epub3.images',
    'text/html': 'https://www.gutenberg.org/ebooks/1.html.images',
    'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/1/1-0.txt',
  },
  languages: ['fr'],
  download_count: 101041,
  ...overrides,
})

const pageOne = {
  count: 4240,
  next: 'https://gutendex.com/books/?languages=fr&page=2',
  previous: null,
  results: [
    book(),
    book({
      id: 2,
      title: 'Candide',
      authors: [{ name: 'Voltaire', birth_year: 1694, death_year: 1778 }],
      formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/2/2-0.txt' },
    }),
  ],
}

const pageTwo = {
  count: 4240,
  next: null,
  previous: 'https://gutendex.com/books/?languages=fr&page=1',
  results: [book({ id: 3, title: 'Madame Bovary' })],
}

const searchResults = {
  count: 48,
  next: null,
  previous: null,
  results: [
    book({ id: 4791, title: 'Voyage au Centre de la Terre', authors: [{ name: 'Verne, Jules', birth_year: 1828, death_year: 1905 }] }),
    book({ id: 5097, title: 'Vingt mille Lieues Sous Les Mers', authors: [{ name: 'Verne, Jules', birth_year: 1828, death_year: 1905 }] }),
  ],
}

function stubFetchPages(...pages: unknown[]) {
  const fn = vi.fn().mockImplementation(async (url: string) => {
    const page = url.includes('page=2') ? pages[1] ?? pages[0] : pages[0]
    return { ok: true, json: async () => page }
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function stubFetchByUrl(pages: Record<string, unknown>) {
  const fn = vi.fn().mockImplementation(async (url: string) => {
    const page = Object.entries(pages).find(([key]) => url.includes(key))?.[1] ?? pages['default']
    return { ok: true, json: async () => page }
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Books />
    </QueryClientProvider>
  )
}

describe('Books', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders titles, authors and read buttons for French books', async () => {
    const fn = stubFetchPages(pageOne)
    renderPage()

    expect(await screen.findByText('Le Fantôme de l’Opéra')).toBeInTheDocument()
    expect(screen.getByText('Gaston Leroux')).toBeInTheDocument()
    expect(screen.getByText('Candide')).toBeInTheDocument()
    expect(screen.getByText('Voltaire')).toBeInTheDocument()

    expect(fn.mock.calls[0][0]).toContain('languages=fr')

    // Both books have plain-text links, so both get a Read button.
    expect(screen.getAllByRole('button', { name: /Read/ })).toHaveLength(2)
    // Only the first book has an epub, and it stays an external download.
    const epub = screen.getByRole('link', { name: /EPUB/ })
    expect(epub).toHaveAttribute('href', 'https://www.gutenberg.org/ebooks/1.epub3.images')
    expect(epub).toHaveAttribute('target', '_blank')
    // Nothing sends the user away except the epub download.
    expect(screen.queryByRole('link', { name: /HTML/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /TXT/ })).toBeNull()
  })

  it('opens the reader in place when Read is clicked', async () => {
    stubFetchByUrl({ default: pageOne })
    renderPage()

    fireEvent.click((await screen.findAllByRole('button', { name: /Read/ }))[0])

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Le Fantôme de l’Opéra')).toBeInTheDocument()
  })

  it('loads the next page of books', async () => {
    stubFetchPages(pageOne, pageTwo)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Load more books' }))

    expect(await screen.findByText('Madame Bovary')).toBeInTheDocument()
    // Both pages are still on screen.
    expect(screen.getByText('Le Fantôme de l’Opéra')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more books' })).toBeNull()
  })

  it('shows an error state with a retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('network down')

    const fn = stubFetchPages(pageOne)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Le Fantôme de l’Opéra')).toBeInTheDocument()
    expect(fn).toHaveBeenCalled()
  })

  it('searches French books by title and shows the match count', async () => {
    const fn = stubFetchByUrl({ 'search=verne': searchResults, default: pageOne })
    renderPage()

    fireEvent.change(screen.getByRole('textbox', { name: 'Search books' }), {
      target: { value: 'verne' },
    })

    expect(await screen.findByText('Voyage au Centre de la Terre', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByText('Vingt mille Lieues Sous Les Mers')).toBeInTheDocument()
    expect(screen.getByText(/48 books matching “verne”/)).toBeInTheDocument()
    expect(fn.mock.calls.some(([url]) => url.includes('search=verne'))).toBe(true)
  })

  it('returns to browsing when the search is cleared', async () => {
    stubFetchByUrl({ 'search=verne': searchResults, default: pageOne })
    renderPage()

    fireEvent.change(screen.getByRole('textbox', { name: 'Search books' }), {
      target: { value: 'verne' },
    })
    await screen.findByText('Voyage au Centre de la Terre', {}, { timeout: 2000 })

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(await screen.findByText('Le Fantôme de l’Opéra', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.queryByText('Voyage au Centre de la Terre')).toBeNull()
  })

  it('shows an empty state when no books match the search', async () => {
    stubFetchByUrl({ default: { count: 0, next: null, previous: null, results: [] } })
    renderPage()

    fireEvent.change(screen.getByRole('textbox', { name: 'Search books' }), {
      target: { value: 'zzzznope' },
    })

    expect(
      await screen.findByText(/No books match “zzzznope”/, {}, { timeout: 2000 })
    ).toBeInTheDocument()
  })

  it('shows an empty state when no books match', async () => {
    stubFetchPages({ count: 0, next: null, previous: null, results: [] })
    renderPage()

    expect(await screen.findByText('No French books found.')).toBeInTheDocument()
  })

  it('shows the cover image when the book has one', async () => {
    stubFetchPages(pageOne)
    renderPage()

    await waitFor(() =>
      expect(screen.getByAltText('Cover of Le Fantôme de l’Opéra')).toBeInTheDocument()
    )
    expect(screen.getByAltText('Cover of Le Fantôme de l’Opéra')).toHaveAttribute(
      'src',
      'https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg'
    )
  })
})