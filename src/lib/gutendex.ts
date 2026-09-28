export interface GutendexAuthor {
  name: string
  birth_year: number | null
  death_year: number | null
}

export interface GutendexBook {
  id: number
  title: string
  authors: GutendexAuthor[]
  formats: Record<string, string>
  languages: string[]
  download_count: number
}

export interface GutendexResponse {
  count: number
  next: string | null
  previous: string | null
  results: GutendexBook[]
}

const BASE_URL = 'https://gutendex.com/books/'
const TIMEOUT_MS = 30000

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`Gutendex request failed: ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchFrenchBooks(page = 1, search = ''): Promise<GutendexResponse> {
  const params = new URLSearchParams({ languages: 'fr', page: String(page) })
  if (search.trim()) params.set('search', search.trim())
  return (await fetchJson(`${BASE_URL}?${params}`)) as GutendexResponse
}

export function getCoverUrl(book: GutendexBook): string | null {
  return book.formats['image/jpeg'] ?? null
}

export interface DownloadLinks {
  epub: string | null
  html: string | null
  text: string | null
}

export function getDownloadLinks(book: GutendexBook): DownloadLinks {
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