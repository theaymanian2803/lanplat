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
