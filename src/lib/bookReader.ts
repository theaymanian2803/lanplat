const TIMEOUT_MS = 30000
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [1000, 2000]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function toProxyPath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'www.gutenberg.org') return null
    return `/gutenberg${parsed.pathname}`
  } catch {
    return null
  }
}

export async function fetchBookText(url: string): Promise<string> {
  const proxyPath = toProxyPath(url)
  if (!proxyPath) throw new Error('Not a Project Gutenberg URL')

  let lastError: unknown = new Error('Could not load the book text')

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let retryable = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(proxyPath, { signal: controller.signal })
      if (res.ok) return await res.text()
      lastError = new Error(`Book text request failed: ${res.status}`)
      retryable = res.status >= 500
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError'
      lastError = timedOut ? new Error('Book text request timed out') : error
      retryable = true
    } finally {
      clearTimeout(timer)
    }

    if (!retryable) throw lastError
    if (attempt < MAX_ATTEMPTS - 1) await sleep(RETRY_DELAYS_MS[attempt] ?? 2000)
  }

  throw lastError
}

/**
 * Keeps only the book body, dropping Project Gutenberg's licence boilerplate header and
 * footer (and the marker lines themselves) so the reader starts and ends at the story.
 */
export function extractBookBody(text: string): string {
  const startMarker = text.search(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK/)
  const endMarker = text.search(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK/)
  const from = startMarker >= 0 ? startMarker : 0
  const to = endMarker >= 0 ? endMarker : text.length
  return text
    .slice(from, to)
    .split('\n')
    .filter((line) => !/^\s*\*\*\* (START|END) OF (THE|THIS) PROJECT GUTENBERG EBOOK/.test(line))
    .join('\n')
}

/** A short line written entirely in capitals reads as a chapter heading. */
export function isChapterHeading(line: string): boolean {
  const trimmed = line.trim()
  return (
    trimmed.length > 0 &&
    trimmed.length < 60 &&
    /^[A-ZÀ-ÖØ-Þ0-9'’\s\-—.!?()]+$/.test(trimmed)
  )
}

export interface BookSection {
  /** The chapter heading the section starts with, or null for an untitled chunk. */
  title: string | null
  text: string
}

/**
 * Splits a book into readable sections: one per chapter heading when the book has them,
 * otherwise fixed-size chunks of lines. Empty front matter before the first heading is
 * discarded.
 */
export function splitIntoChapters(body: string, fallbackLines = 250): BookSection[] {
  const lines = body.split('\n')
  const sections: BookSection[] = []
  let current: BookSection | null = null

  for (const line of lines) {
    if (isChapterHeading(line)) {
      if (current && current.text.trim()) sections.push(current)
      current = { title: line.trim(), text: '' }
      continue
    }
    if (current) {
      current.text += (current.text ? '\n' : '') + line
    } else {
      current = { title: null, text: line }
    }
  }
  if (current && current.text.trim()) sections.push(current)

  const hasHeadings = sections.some((section) => section.title !== null)
  if (hasHeadings) return sections

  const chunks: BookSection[] = []
  for (let i = 0; i < lines.length; i += fallbackLines) {
    chunks.push({ title: null, text: lines.slice(i, i + fallbackLines).join('\n') })
  }
  return chunks
}