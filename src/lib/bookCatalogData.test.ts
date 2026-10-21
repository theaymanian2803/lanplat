import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { BOOKS_PAGE_SIZE, BOOK_LANGUAGES, type BookPage } from '@/lib/bookCatalog'

const readPage = (code: string, page: number): BookPage | null => {
  const file = path.join(process.cwd(), 'public', 'books', code, `${page}.json`)
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8')) as BookPage
}

describe('generated book catalogue', () => {
  for (const language of BOOK_LANGUAGES) {
    it(`ships a readable five-per-page catalogue for ${language.name}`, () => {
      let page = 1
      let total = 0
      let sawLastPage = false

      while (!sawLastPage) {
        const data = readPage(language.code, page)
        expect(data, `missing public/books/${language.code}/${page}.json`).not.toBeNull()
        if (!data) return

        expect(data.books.length).toBeGreaterThan(0)
        expect(data.books.length).toBeLessThanOrEqual(BOOKS_PAGE_SIZE)

        for (const book of data.books) {
          expect(book.title.trim()).not.toBe('')
          expect(book.languages).toContain(language.code)
          expect(book.formats['text/plain; charset=utf-8']).toMatch(
            /^https:\/\/www\.gutenberg\.org\//
          )
        }

        total += data.books.length
        sawLastPage = !data.hasMore
        page += 1
      }

      expect(total).toBeGreaterThanOrEqual(BOOKS_PAGE_SIZE)
    })
  }
})
