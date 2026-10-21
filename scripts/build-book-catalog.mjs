#!/usr/bin/env node
/**
 * Builds the static book catalogue the Books page reads from.
 *
 * Source of truth is Project Gutenberg's official catalogue CSV, not a third-party API.
 * Output is committed so deployments never depend on an external service:
 *
 *   public/books/<lang>/<page>.json   // exactly five books per page
 *
 * Run with `npm run books:catalog` when you want to refresh the shelves.
 */
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

const CATALOG_URL = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz'
const CACHE_FILE = path.resolve('scripts', '.cache', 'pg_catalog.csv')
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const DOWNLOAD_TIMEOUT_MS = 180000
const OUT_DIR = path.resolve('public', 'books')

const LANGUAGES = [
  { name: 'French', code: 'fr' },
  { name: 'Spanish', code: 'es' },
  { name: 'Swedish', code: 'sv' },
  { name: 'Danish', code: 'da' },
]

const PAGE_SIZE = 5
const POOL_SIZE = 40
const CHECK_LIMIT = 180
const CONCURRENCY = 12
const REQUEST_TIMEOUT_MS = 10000
const MAX_ATTEMPTS = 2

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Minimal RFC 4180 parser; the Gutenberg CSV has quoted fields with commas and newlines. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') inQuotes = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** "Wilde, Oscar, 1854-1900" -> { name: "Wilde, Oscar", birth_year: 1854, death_year: 1900 } */
export function parseAuthor(raw) {
  const cleaned = raw.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim()
  const match = cleaned.match(/^(.*),\s*(\d{4})?-(\d{4})?$/)
  if (!match) return { name: cleaned, birth_year: null, death_year: null }
  return {
    name: match[1].trim(),
    birth_year: match[2] ? Number(match[2]) : null,
    death_year: match[3] ? Number(match[3]) : null,
  }
}

const textUrl = (id) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`
const coverUrl = (id) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`

function toBook(row, code) {
  const id = Number(row.id)
  const formats = {
    'text/plain; charset=utf-8': textUrl(id),
    'text/html': `https://www.gutenberg.org/ebooks/${id}.html.images`,
    'application/epub+zip': `https://www.gutenberg.org/ebooks/${id}.epub3.images`,
  }
  if (row.hasCover) formats['image/jpeg'] = coverUrl(id)

  return {
    id,
    title: row.title,
    authors: row.authors,
    formats,
    languages: [code],
  }
}

async function isAvailable(url) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'lingo-book-catalog/1.0 (+https://languageplatform.unccode.site)' },
      })
      if (res.ok) return true
      if (res.status === 404 || res.status === 410) return false
    } catch {
      // network hiccup or timeout: retry below
    } finally {
      clearTimeout(timer)
    }
    await sleep(600 * (attempt + 1))
  }
  return false
}

function candidatesFor(rows, code) {
  const candidates = []
  for (const row of rows) {
    if (row.type !== 'Text' || !row.id) continue
    if (row.languages[0] !== code) continue
    candidates.push(row)
  }
  return candidates.sort((a, b) => a.id - b.id)
}

async function buildLanguage(rows, language) {
  const candidates = candidatesFor(rows, language.code).slice(0, CHECK_LIMIT)
  const chosen = []

  for (let start = 0; start < candidates.length && chosen.length < POOL_SIZE; start += CONCURRENCY) {
    const batch = candidates.slice(start, start + CONCURRENCY)
    const started = Date.now()
    const checked = await Promise.all(
      batch.map(async (row) => {
        if (!(await isAvailable(textUrl(row.id)))) return null
        const hasCover = await isAvailable(coverUrl(row.id))
        return { ...row, hasCover }
      })
    )
    for (const row of checked) {
      if (row && chosen.length < POOL_SIZE) chosen.push(row)
    }
    process.stdout.write(
      `  ${language.code} ${Math.min(start + CONCURRENCY, candidates.length)}/${candidates.length} checked, ${chosen.length} kept (${Date.now() - started}ms)\n`
    )
  }

  const dir = path.join(OUT_DIR, language.code)
  await mkdir(dir, { recursive: true })

  const pageCount = Math.ceil(chosen.length / PAGE_SIZE)
  for (let page = 0; page < pageCount; page += 1) {
    const payload = {
      books: chosen.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row) =>
        toBook(row, language.code)
      ),
      hasMore: page < pageCount - 1,
    }
    await writeFile(path.join(dir, `${page + 1}.json`), `${JSON.stringify(payload, null, 2)}\n`)
  }

  return { count: chosen.length, pages: pageCount }
}

async function cachedCatalog() {
  const override = process.env.PG_CATALOG_CSV
  if (override) {
    process.stdout.write(`Reading ${override}\n`)
    return readFile(path.resolve(override), 'utf8')
  }

  try {
    const info = await stat(CACHE_FILE)
    if (Date.now() - info.mtimeMs < CACHE_MAX_AGE_MS) {
      process.stdout.write('Using cached catalogue\n')
      return readFile(CACHE_FILE, 'utf8')
    }
  } catch {
    // no usable cache yet
  }

  process.stdout.write(`Fetching ${CATALOG_URL}\n`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
  try {
    const res = await fetch(CATALOG_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'lingo-book-catalog/1.0 (+https://languageplatform.unccode.site)' },
    })
    if (!res.ok) throw new Error(`Catalogue download failed: ${res.status}`)
    const csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')
    await mkdir(path.dirname(CACHE_FILE), { recursive: true })
    await writeFile(CACHE_FILE, csv)
    return csv
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  const only = process.argv[2]
  const languages = only ? LANGUAGES.filter((language) => language.code === only) : LANGUAGES
  if (languages.length === 0) throw new Error(`Unknown language code: ${only}`)

  const started = Date.now()
  const csv = await cachedCatalog()
  process.stdout.write(`Catalogue ready: ${csv.length} chars in ${Date.now() - started}ms\n`)

  const [header, ...rows] = parseCsv(csv)
  process.stdout.write(`Parsed ${rows.length} rows in ${Date.now() - started}ms\n`)
  const columns = Object.fromEntries(header.map((name, index) => [name, index]))
  const required = ['Text#', 'Type', 'Title', 'Language', 'Authors']
  for (const name of required) {
    if (columns[name] === undefined) throw new Error(`Catalogue is missing column: ${name}`)
  }

  const records = rows
    .filter((row) => row[columns['Text#']] && row[columns.Type] === 'Text')
    .map((row) => {
      const authors = (row[columns.Authors] ?? '')
        .split(';')
        .map((name) => name.trim())
        .filter(Boolean)
        .map(parseAuthor)
      return {
        id: Number(row[columns['Text#']]),
        title: row[columns.Title] ?? '',
        languages: (row[columns.Language] ?? '')
          .split(';')
          .map((code) => code.trim())
          .filter(Boolean),
        authors,
        type: row[columns.Type],
      }
    })
    .filter((row) => Number.isFinite(row.id) && row.title.trim() !== '')

  if (!only) await rm(OUT_DIR, { recursive: true, force: true })

  for (const language of languages) {
    const { count, pages } = await buildLanguage(records, language)
    process.stdout.write(`${language.code}: ${count} books in ${pages} page(s)\n`)
    if (count < PAGE_SIZE) {
      process.stdout.write(`warning: ${language.code} has fewer than ${PAGE_SIZE} readable books\n`)
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
  process.exitCode = 1
})
