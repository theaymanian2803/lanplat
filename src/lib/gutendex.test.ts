import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  displayAuthorName,
  fetchFrenchBooks,
  getCoverUrl,
  getDownloadLinks,
  type GutendexBook,
} from '@/lib/gutendex'

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

const response = {
  count: 4240,
  next: 'https://gutendex.com/books/?languages=fr&page=2',
  previous: null,
  results: [book()],
}

function stubFetch(value: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => value })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchFrenchBooks', () => {
  it('requests French books from Gutendex', async () => {
    const fn = stubFetch(response)

    const result = await fetchFrenchBooks()

    expect(fn.mock.calls[0][0]).toBe('https://gutendex.com/books/?languages=fr&page=1')
    expect(result.count).toBe(4240)
    expect(result.results[0].title).toBe('Le Fantôme de l’Opéra')
  })

  it('requests a given page', async () => {
    const fn = stubFetch(response)

    await fetchFrenchBooks(3)

    expect(fn.mock.calls[0][0]).toBe('https://gutendex.com/books/?languages=fr&page=3')
  })

  it('adds the search term when one is given', async () => {
    const fn = stubFetch(response)

    await fetchFrenchBooks(1, 'verne')

    expect(fn.mock.calls[0][0]).toBe(
      'https://gutendex.com/books/?languages=fr&page=1&search=verne'
    )
  })

  it('throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await expect(fetchFrenchBooks()).rejects.toThrow('Gutendex request failed: 500')
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