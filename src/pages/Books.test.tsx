import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import Books from './Books'
import type { Book } from '@/lib/bookCatalog'

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn().mockResolvedValue([]) },
  vocabularyDb: { insert: vi.fn().mockResolvedValue(undefined) },
}))

const book = (id: number, title: string, overrides: Partial<Book> = {}): Book => ({
  id,
  title,
  authors: [{ name: 'Leroux, Gaston', birth_year: 1868, death_year: 1927 }],
  formats: {
    'text/plain; charset=utf-8': `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  },
  languages: ['fr'],
  ...overrides,
})

const five = (prefix: string) =>
  Array.from({ length: 5 }, (_, i) => book(i + 1, `${prefix} ${i + 1}`))

const jsonResponse = (value: unknown) => ({
  ok: true,
  json: async () => value,
  text: async () => JSON.stringify(value),
})

const textResponse = (value: string) => ({
  ok: true,
  json: async () => ({}),
  text: async () => value,
})

type Stub = [matcher: string, response: unknown]

function stubFetch(entries: Stub[]) {
  const fn = vi.fn().mockImplementation(async (url: string) => {
    const entry = entries.find(([matcher]) => String(url).includes(matcher))
    return entry ? entry[1] : { ok: false, status: 404, json: async () => ({}), text: async () => '' }
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

const pickLanguage = async (name: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Book language' }))
  fireEvent.click(await screen.findByRole('option', { name }))
}

const twoPageShelf = (): Stub[] => [
  ['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: true })],
  [
    '/books/fr/2.json',
    jsonResponse({
      books: [
        book(6, 'Candide, ou l’optimisme', {
          authors: [{ name: 'Voltaire', birth_year: 1694, death_year: 1778 }],
        }),
        book(7, 'Le Fantôme de l’Opéra'),
      ],
      hasMore: false,
    }),
  ],
]

describe('Books', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads exactly five French books on the first visit', async () => {
    const fn = stubFetch([['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: true })]])
    renderPage()

    expect(await screen.findByText('Livre 1')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Read/ })).toHaveLength(5)

    const bookCalls = fn.mock.calls.filter(([url]) => String(url).includes('/books/'))
    expect(bookCalls).toHaveLength(1)
    expect(bookCalls[0][0]).toBe('/books/fr/1.json')
  })

  it('lists the four supported languages and no Japanese', async () => {
    stubFetch([['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: false })]])
    renderPage()
    await screen.findByText('Livre 1')

    fireEvent.click(screen.getByRole('combobox', { name: 'Book language' }))

    for (const name of ['French', 'Spanish', 'Swedish', 'Danish']) {
      expect(await screen.findByRole('option', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('option', { name: 'Japanese' })).toBeNull()
  })

  it('loads five books in the selected language', async () => {
    const fn = stubFetch([
      ['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: false })],
      ['/books/es/1.json', jsonResponse({ books: five('Libro'), hasMore: false })],
    ])
    renderPage()
    await screen.findByText('Livre 1')

    await pickLanguage('Spanish')

    expect(await screen.findByText('Libro 1')).toBeInTheDocument()
    expect(screen.queryByText('Livre 1')).toBeNull()
    expect(screen.getAllByRole('button', { name: /Read/ })).toHaveLength(5)
    expect(fn.mock.calls.some(([url]) => url === '/books/es/1.json')).toBe(true)
  })

  it('appends the next five books when Load more is clicked', async () => {
    const fn = stubFetch([
      ['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: true })],
      [
        '/books/fr/2.json',
        jsonResponse({ books: Array.from({ length: 5 }, (_, i) => book(i + 6, `Suite ${i + 1}`)), hasMore: false }),
      ],
    ])
    renderPage()
    await screen.findByText('Livre 1')

    fireEvent.click(screen.getByRole('button', { name: 'Load more books' }))

    expect(await screen.findByText('Suite 1')).toBeInTheDocument()
    expect(screen.getByText('Livre 1')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Read/ })).toHaveLength(10)
    expect(fn.mock.calls.some(([url]) => url === '/books/fr/2.json')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Load more books' })).toBeNull()
  })

  it('does not show Load more when there are no further pages', async () => {
    stubFetch([['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: false })]])
    renderPage()

    await screen.findByText('Livre 1')
    expect(screen.queryByRole('button', { name: 'Load more books' })).toBeNull()
  })

  it('shows an error state with a retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('network down')

    const fn = stubFetch([['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: false })]])
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Livre 1')).toBeInTheDocument()
    expect(fn).toHaveBeenCalled()
  })

  it('makes the whole book card the link with no separate Read or EPUB buttons', async () => {
    stubFetch([['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: false })]])
    renderPage()

    await screen.findByText('Livre 1')
    const card = screen.getByRole('button', { name: 'Read Livre 1' })

    expect(within(card).queryByRole('button')).toBeNull()
    expect(within(card).queryByText(/^Read$/)).toBeNull()
    expect(within(card).queryByText(/^EPUB$/)).toBeNull()
  })

  it('opens the reader in place when a book card is clicked', async () => {
    stubFetch([
      ['/books/fr/1.json', jsonResponse({ books: five('Livre'), hasMore: false })],
      [
        '/gutenberg/',
        textResponse(
          '*** START OF THE PROJECT GUTENBERG EBOOK ***\n\nCHAPITRE PREMIER\n\nLe fantôme existait.\n\n*** END OF THE PROJECT GUTENBERG EBOOK ***'
        ),
      ],
    ])
    renderPage()

    fireEvent.click((await screen.findAllByRole('button', { name: /Read/ }))[0])

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Livre 1')).toBeInTheDocument()
  })

  it('shows the cover image when the book has one', async () => {
    stubFetch([
      [
        '/books/fr/1.json',
        jsonResponse({
          books: [
            book(1, 'Le Fantôme de l’Opéra', {
              formats: {
                'image/jpeg': 'https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg',
                'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/1/1-0.txt',
              },
            }),
          ],
          hasMore: false,
        }),
      ],
    ])
    renderPage()

    await waitFor(() =>
      expect(screen.getByAltText('Cover of Le Fantôme de l’Opéra')).toBeInTheDocument()
    )
    expect(screen.getByAltText('Cover of Le Fantôme de l’Opéra')).toHaveAttribute(
      'src',
      'https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg'
    )
  })

  it('finds a book that has not been loaded yet as the user types', async () => {
    const fn = stubFetch([...twoPageShelf()])
    renderPage()
    await screen.findByText('Livre 1')

    const search = screen.getByLabelText('Search books')
    fireEvent.change(search, { target: { value: 'candide' } })

    // The first search render must not claim there are no matches while the shelf loads.
    expect(screen.queryByText(/No books match/)).toBeNull()
    expect(screen.getByText('Searching the shelf…')).toBeInTheDocument()

    expect(await screen.findByText('Candide, ou l’optimisme')).toBeInTheDocument()
    expect(screen.queryByText('Livre 1')).toBeNull()
    expect(screen.getByText('1 match for “candide”')).toBeInTheDocument()
    expect(fn.mock.calls.some(([url]) => url === '/books/fr/2.json')).toBe(true)

    // A second keystroke reuses the cached shelf rather than walking the catalogue again.
    fireEvent.change(search, { target: { value: 'voltaire' } })
    expect(await screen.findByText('Candide, ou l’optimisme')).toBeInTheDocument()
    expect(fn.mock.calls.filter(([url]) => url === '/books/fr/1.json')).toHaveLength(2)
  })

  it('matches without accents, curly apostrophes, or surname order', async () => {
    stubFetch([...twoPageShelf()])
    renderPage()
    await screen.findByText('Livre 1')
    const search = screen.getByLabelText('Search books')

    fireEvent.change(search, { target: { value: 'fantome' } })
    expect(await screen.findByText('Le Fantôme de l’Opéra')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: "l'opera" } })
    expect(await screen.findByText('Le Fantôme de l’Opéra')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'gaston' } })
    expect(await screen.findByText('Le Fantôme de l’Opéra')).toBeInTheDocument()
    expect(screen.queryByText('Candide, ou l’optimisme')).toBeNull()
  })

  it('shows an empty result message and hides Load more while searching', async () => {
    stubFetch([...twoPageShelf()])
    renderPage()
    await screen.findByText('Livre 1')

    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: 'zzz' } })

    expect(await screen.findByText('No books match “zzz”.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more books' })).toBeNull()
  })

  it('restores the shelf when the search is cleared', async () => {
    stubFetch([...twoPageShelf()])
    renderPage()
    await screen.findByText('Livre 1')

    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: 'candide' } })
    await screen.findByText('Candide, ou l’optimisme')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(await screen.findByText('Livre 1')).toBeInTheDocument()
    expect(screen.queryByText('Candide, ou l’optimisme')).toBeNull()
  })

  it('keeps the query when the language changes', async () => {
    stubFetch([
      ...twoPageShelf(),
      ['/books/es/1.json', jsonResponse({ books: five('Libro'), hasMore: true })],
      [
        '/books/es/2.json',
        jsonResponse({ books: [book(9, 'Candide en español')], hasMore: false }),
      ],
    ])
    renderPage()
    await screen.findByText('Livre 1')

    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: 'candide' } })
    await screen.findByText('Candide, ou l’optimisme')
    await pickLanguage('Spanish')

    expect(await screen.findByText('Candide en español')).toBeInTheDocument()
    expect(screen.queryByText('Candide, ou l’optimisme')).toBeNull()
    expect(screen.queryByText('Livre 1')).toBeNull()
  })

  it('shows a retry when the shelf search fails and recovers on retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url === '/books/fr/1.json') return jsonResponse({ books: five('Livre'), hasMore: true })
        if (url === '/books/fr/2.json') throw new Error('network down')
        return { ok: false, status: 404, json: async () => ({}), text: async () => '' }
      })
    )
    renderPage()
    await screen.findByText('Livre 1')

    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: 'candide' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not search the shelf.')
    expect(screen.queryByText(/0 matches/)).toBeNull()

    const fn = stubFetch([...twoPageShelf()])
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Candide, ou l’optimisme')).toBeInTheDocument()
    expect(fn).toHaveBeenCalled()
  })
})
