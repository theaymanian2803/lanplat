import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  extractBookBody,
  fetchBookText,
  isChapterHeading,
  splitIntoChapters,
  toProxyPath,
} from '@/lib/bookReader'

const BOOK_URL = 'https://www.gutenberg.org/cache/epub/62215/pg62215.txt'

function stubFetch(value: unknown) {
  const fn = vi.fn().mockResolvedValue(value)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('toProxyPath', () => {
  it('maps a Gutenberg URL to the same-origin proxy path', () => {
    expect(toProxyPath(BOOK_URL)).toBe('/gutenberg/cache/epub/62215/pg62215.txt')
  })

  it('rejects URLs that are not Gutenberg', () => {
    expect(toProxyPath('https://example.com/book.txt')).toBeNull()
    expect(toProxyPath('not a url')).toBeNull()
  })
})

describe('fetchBookText', () => {
  it('fetches the proxy path and returns the text', async () => {
    const fn = stubFetch({ ok: true, text: async () => 'Bonjour le monde' })

    await expect(fetchBookText(BOOK_URL)).resolves.toBe('Bonjour le monde')
    expect(fn.mock.calls[0][0]).toBe('/gutenberg/cache/epub/62215/pg62215.txt')
  })

  it('throws when the proxy responds with an error', async () => {
    stubFetch({ ok: false, status: 502 })

    await expect(fetchBookText(BOOK_URL)).rejects.toThrow('Book text request failed: 502')
  })

  it('retries a 504 before giving up', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 504 })
      .mockResolvedValueOnce({ ok: true, text: async () => 'Enfin réussi' })

    vi.stubGlobal('fetch', fn)

    await expect(fetchBookText(BOOK_URL)).resolves.toBe('Enfin réussi')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('gives up after the retries are exhausted', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, status: 504 })
    vi.stubGlobal('fetch', fn)

    await expect(fetchBookText(BOOK_URL)).rejects.toThrow('Book text request failed: 504')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not retry client errors', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    vi.stubGlobal('fetch', fn)

    await expect(fetchBookText(BOOK_URL)).rejects.toThrow('Book text request failed: 404')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries when the request times out', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }))

    vi.stubGlobal('fetch', fn)

    await expect(fetchBookText(BOOK_URL)).rejects.toThrow('Book text request timed out')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws for non-Gutenberg URLs', async () => {
    stubFetch({ ok: true, text: async () => '' })

    await expect(fetchBookText('https://example.com/book.txt')).rejects.toThrow(
      'Not a Project Gutenberg URL'
    )
  })
})

describe('extractBookBody', () => {
  const sample =
    'The Project Gutenberg eBook...\n*** START OF THE PROJECT GUTENBERG EBOOK LE FANTÔME DE L’OPÉRA ***\n\nCHAPITRE PREMIER\n\nLe fantôme existait.\n\n*** END OF THE PROJECT GUTENBERG EBOOK LE FANTÔME DE L’OPÉRA ***\n\nEnd of the Project Gutenberg EBook.'

  it('drops the boilerplate before and after the book body', () => {
    const body = extractBookBody(sample)
    expect(body).toContain('CHAPITRE PREMIER')
    expect(body).toContain('Le fantôme existait.')
    expect(body).not.toContain('Project Gutenberg eBook...')
    expect(body).not.toContain('End of the Project Gutenberg')
    expect(body).not.toContain('*** START OF')
    expect(body).not.toContain('*** END OF')
  })

  it('keeps the whole text when there is no boilerplate', () => {
    expect(extractBookBody('Just a story.')).toBe('Just a story.')
  })
})

describe('isChapterHeading', () => {
  it('recognises short all-caps lines', () => {
    expect(isChapterHeading('CHAPITRE PREMIER')).toBe(true)
    expect(isChapterHeading("L'AVENTURE COMMENCE")).toBe(true)
  })

  it('rejects long lines and lowercase lines', () => {
    expect(isChapterHeading('Le fantôme existait.')).toBe(false)
    expect(isChapterHeading('A'.repeat(80))).toBe(false)
    expect(isChapterHeading('')).toBe(false)
  })
})

describe('splitIntoChapters', () => {
  it('splits a book into one section per chapter heading', () => {
    const body = 'CHAPITRE PREMIER\n\nLe fantôme existait.\n\nCHAPITRE II\n\nOn ne le croyait pas.'
    const sections = splitIntoChapters(body)

    expect(sections).toHaveLength(2)
    expect(sections[0].title).toBe('CHAPITRE PREMIER')
    expect(sections[0].text).toContain('Le fantôme existait.')
    expect(sections[1].title).toBe('CHAPITRE II')
    expect(sections[1].text).toContain('On ne le croyait pas.')
  })

  it('drops empty front matter before the first chapter', () => {
    const body = '\n\n\nCHAPITRE PREMIER\n\nLe fantôme existait.'
    const sections = splitIntoChapters(body)

    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('CHAPITRE PREMIER')
  })

  it('falls back to fixed line chunks when there are no headings', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `ligne ${i + 1}`)
    const sections = splitIntoChapters(lines.join('\n'), 4)

    expect(sections).toHaveLength(3)
    expect(sections[0].title).toBeNull()
    expect(sections[0].text.split('\n')).toHaveLength(4)
    expect(sections[2].text.split('\n')).toHaveLength(2)
  })
})