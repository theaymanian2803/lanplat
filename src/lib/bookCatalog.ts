export interface BookAuthor {
  name: string
  birth_year: number | null
  death_year: number | null
}

export interface Book {
  id: number
  title: string
  authors: BookAuthor[]
  formats: Record<string, string>
  languages: string[]
}

export interface BookPage {
  books: Book[]
  hasMore: boolean
}

export interface BookLanguage {
  name: string
  code: string
}

/** Each static page carries exactly this many books. */
export const BOOKS_PAGE_SIZE = 5

/** The languages whose catalogues are built into the app. */
export const BOOK_LANGUAGES: BookLanguage[] = [
  { name: 'French', code: 'fr' },
  { name: 'Spanish', code: 'es' },
  { name: 'Swedish', code: 'sv' },
  { name: 'Danish', code: 'da' },
]

const TIMEOUT_MS = 10000

/** Pages are static JSON built by `scripts/build-book-catalog.mjs`, so no third-party call runs here. */
export async function fetchBookPage(code: string, page: number): Promise<BookPage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`/books/${code}/${page}.json`, { signal: controller.signal })
    if (!res.ok) throw new Error(`Book page request failed: ${res.status}`)
    return (await res.json()) as BookPage
  } finally {
    clearTimeout(timer)
  }
}

export function getCoverUrl(book: Book): string | null {
  return book.formats['image/jpeg'] ?? null
}

export interface DownloadLinks {
  epub: string | null
  html: string | null
  text: string | null
}

export function getDownloadLinks(book: Book): DownloadLinks {
  return {
    epub: book.formats['application/epub+zip'] ?? null,
    html: book.formats['text/html'] ?? null,
    text:
      book.formats['text/plain; charset=utf-8'] ??
      book.formats['text/plain; charset=us-ascii'] ??
      null,
  }
}

export function displayAuthorName(name: string): string {
  const [last, ...rest] = name.split(', ')
  if (rest.length === 0) return last
  return `${rest.join(' ')} ${last}`
}

/** A safety stop if a built page ever claims more pages indefinitely. */
const MAX_CATALOG_PAGES = 100

/** Walks every static catalogue page for one language. Used when searching the whole shelf. */
export async function fetchAllBooks(code: string): Promise<Book[]> {
  const books: Book[] = []
  for (let page = 1; page <= MAX_CATALOG_PAGES; page += 1) {
    const result = await fetchBookPage(code, page)
    books.push(...result.books)
    if (!result.hasMore) break
  }
  return books
}

/** Case- and accent-insensitive text for shelf matching; curly quotes become straight. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019\u2018\u0060\u00b4]/g, "'")
    .toLowerCase()
}

/** Filters a shelf by title or author. A blank query returns the shelf unchanged. */
export function searchBooks(books: Book[], query: string): Book[] {
  const needle = normalizeForSearch(query.trim())
  if (!needle) return books
  return books.filter((book) => {
    if (normalizeForSearch(book.title).includes(needle)) return true
    return book.authors.some(
      (author) =>
        normalizeForSearch(displayAuthorName(author.name)).includes(needle) ||
        normalizeForSearch(author.name).includes(needle),
    )
  })
}
