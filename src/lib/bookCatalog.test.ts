import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BOOKS_PAGE_SIZE,
  BOOK_LANGUAGES,
  displayAuthorName,
  fetchBookPage,
  getCoverUrl,
  getDownloadLinks,
  type Book,
} from '@/lib/bookCatalog'

const book = (overrides: Partial<Book> = {}): Book => ({
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
  ...overrides,
})

function stubFetch(value: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => value })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BOOK_LANGUAGES', () => {
  it('offers exactly the four supported languages', () => {
    expect(BOOK_LANGUAGES).toEqual([
      { name: 'French', code: 'fr' },
      { name: 'Spanish', code: 'es' },
      { name: 'Swedish', code: 'sv' },
      { name: 'Danish', code: 'da' },
    ])
  })

  it('does not offer Japanese', () => {
    expect(BOOK_LANGUAGES.map((language) => language.name)).not.toContain('Japanese')
  })
})

describe('BOOKS_PAGE_SIZE', () => {
  it('caps each page at five books', () => {
    expect(BOOKS_PAGE_SIZE).toBe(5)
  })
})

describe('fetchBookPage', () => {
  it('loads the static page for a language', async () => {
    const fn = stubFetch({ books: [book()], hasMore: true })

    const page = await fetchBookPage('fr', 1)

    expect(fn.mock.calls[0][0]).toBe('/books/fr/1.json')
    expect(page.books).toHaveLength(1)
    expect(page.books[0].title).toBe('Le Fantôme de l’Opéra')
    expect(page.hasMore).toBe(true)
  })

  it('requests the requested page number', async () => {
    const fn = stubFetch({ books: [], hasMore: false })

    await fetchBookPage('es', 3)

    expect(fn.mock.calls[0][0]).toBe('/books/es/3.json')
  })

  it('throws when the page is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await expect(fetchBookPage('da', 1)).rejects.toThrow('Book page request failed: 404')
  })
})

describe('getCoverUrl', () => {
  it('returns the jpeg cover when present', () => {
    expect(getCoverUrl(book())).toBe('https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg')
  })

  it('returns null when the book has no cover', () => {
    expect(getCoverUrl(book({ formats: {} }))).toBeNull()
  })
})

describe('getDownloadLinks', () => {
  it('picks the epub, html and utf-8 text links', () => {
    expect(getDownloadLinks(book())).toEqual({
      epub: 'https://www.gutenberg.org/ebooks/1.epub3.images',
      html: 'https://www.gutenberg.org/ebooks/1.html.images',
      text: 'https://www.gutenberg.org/files/1/1-0.txt',
    })
  })

  it('falls back to the ascii text link when utf-8 is missing', () => {
    const ascii = book({ formats: { 'text/plain; charset=us-ascii': 'https://example.com/a.txt' } })
    expect(getDownloadLinks(ascii).text).toBe('https://example.com/a.txt')
  })

  it('returns null for formats the book does not carry', () => {
    expect(getDownloadLinks(book({ formats: {} }))).toEqual({
      epub: null,
      html: null,
      text: null,
    })
  })
})

describe('displayAuthorName', () => {
  it('turns "Last, First" into "First Last"', () => {
    expect(displayAuthorName('Leroux, Gaston')).toBe('Gaston Leroux')
  })

  it('leaves single-part names alone', () => {
    expect(displayAuthorName('Voltaire')).toBe('Voltaire')
  })
})
