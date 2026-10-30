# Books Phrase Capture and Shelf Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the book reader capture any selected phrase through an explicit "Add to vocab" button, and let `/books` search the whole shelf of the current language as the user types.

**Architecture:** The reader replaces its auto-opening selection listener with a stateful selection pill, mirroring the pattern in `StudyRoom.tsx`. The books page adds a cached query that walks the static catalogue pages once, then filters locally with normalized matching.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query v5, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-30-books-selection-and-search-design.md`

## Global Constraints

- No new dependencies.
- The catalogue is static: `public/books/<code>/<page>.json`, exactly 5 books per page, 40 books per language (fr, es, sv, da). No external API calls.
- Copy exactly: `Add to vocab`, `Search title or author…`, `Search books`, `Clear search`, `Searching the shelf…`, `No books match “{query}”.`, `{n} match` / `{n} matches for “{query}”`, `Could not search the shelf.`
- `AddWordPanel` is not modified; multi-word text goes into its Word field as-is (the panel lowercases it).
- Reader pagination, keyboard arrows, the single close control, and language prefill must keep working.
- Do not touch `StudyRoom.tsx`, `TranscriptStrip.tsx`, or their selection behavior.
- The pill must render inside `DialogContent` (not a body portal): Radix sets `pointer-events: none` on `body` while a modal dialog is open, and `DialogContent`'s `translate-x/y` transform means a `fixed` child would be positioned against the dialog, not the viewport.

## Review Focus

- A touch long-press selection never fires `mouseup`; the pill must still appear from `selectionchange`.
- A selection that starts inside the reader and ends outside (or vice versa) must not produce a pill.
- Tapping the pill while the native selection handles/menu are open must capture the phrase, not lose it to the `pointerdown` collapse.
- Searching immediately after opening the page, before the first five cards resolve, must not flash "No books match".
- A catalogue search that fails on page 2+ must offer Retry and must not break the ordinary shelf.

---

### Task 1: Shelf search helpers

**Files:**
- Modify: `src/lib/bookCatalog.ts` (append after `displayAuthorName`)
- Test: `src/lib/bookCatalog.test.ts`

**Interfaces:**
- Consumes: `fetchBookPage(code, page)`, `displayAuthorName(name)`, `type Book` (already exported).
- Produces:
  - `fetchAllBooks(code: string): Promise<Book[]>`
  - `normalizeForSearch(value: string): string`
  - `searchBooks(books: Book[], query: string): Book[]`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/bookCatalog.test.ts`, updating the import list to include `fetchAllBooks`, `normalizeForSearch`, `searchBooks`:

```ts
describe('fetchAllBooks', () => {
  it('walks pages until hasMore is false', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ books: [book({ id: 1 })], hasMore: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ books: [book({ id: 2 })], hasMore: false }) })
    vi.stubGlobal('fetch', fn)

    const all = await fetchAllBooks('fr')

    expect(all.map((b) => b.id)).toEqual([1, 2])
    expect(fn.mock.calls.map(([url]) => url)).toEqual(['/books/fr/1.json', '/books/fr/2.json'])
  })

  it('stops after the first page when hasMore is false', async () => {
    const fn = stubFetch({ books: [book()], hasMore: false })

    const all = await fetchAllBooks('es')

    expect(all).toHaveLength(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('normalizeForSearch', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeForSearch('Le Fantôme de l’Opéra')).toBe("le fantome de l'opera")
  })
})

describe('searchBooks', () => {
  const shelf = [
    book({ id: 1, title: 'Le Fantôme de l’Opéra' }),
    book({
      id: 2,
      title: 'Candide, ou l’optimisme',
      authors: [{ name: 'Voltaire', birth_year: 1694, death_year: 1778 }],
    }),
  ]

  it('matches titles without accents or curly apostrophes', () => {
    expect(searchBooks(shelf, 'fantome').map((b) => b.id)).toEqual([1])
    expect(searchBooks(shelf, "l'opera").map((b) => b.id)).toEqual([1])
  })

  it('matches author names in either order', () => {
    expect(searchBooks(shelf, 'leroux').map((b) => b.id)).toEqual([1])
    expect(searchBooks(shelf, 'gaston').map((b) => b.id)).toEqual([1])
  })

  it('returns the whole shelf for a blank query and nothing for a miss', () => {
    expect(searchBooks(shelf, '   ')).toEqual(shelf)
    expect(searchBooks(shelf, 'zzz')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/bookCatalog.test.ts`
Expected: FAIL — `fetchAllBooks`, `normalizeForSearch`, and `searchBooks` are not exported.

- [ ] **Step 3: Implement the helpers**

In `src/lib/bookCatalog.ts`, add a `MAX_CATALOG_PAGES = 100` guard so a bad `hasMore` cannot loop forever. `fetchAllBooks` loops from page 1, concatenates `books`, and stops when `hasMore` is false. `normalizeForSearch` lowercases, strips combining marks with `NFD` + `/[\u0300-\u036f]/g`, and maps curly quotes (`, ‘, ´) to `'`. `searchBooks` normalizes the trimmed query, returns `books` when it is empty, and keeps a book when its normalized title, normalized `displayAuthorName(author.name)`, or normalized raw author name includes the needle.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/bookCatalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bookCatalog.ts src/lib/bookCatalog.test.ts
git commit -m "feat: add book shelf search helpers"
```

---

### Task 2: Reader selection pill

**Files:**
- Modify: `src/components/books/BookReaderDialog.tsx`
- Test: `src/components/books/BookReaderDialog.test.tsx`

**Interfaces:**
- Consumes: `getFloatingButtonPosition(rect, viewportWidth)` from `@/lib/textSelection`; `AddWordPanel` props `initialWord`, `defaultLanguage`.
- Produces: no exports. The reader's only new UI contract is a button whose accessible name is `Add to vocab`.

- [ ] **Step 1: Add a selection stub and rewrite the selection tests**

In `src/components/books/BookReaderDialog.test.tsx`, add a helper. Every selection stub must supply `getRangeAt`, because the reader reads the range rectangle:

```ts
const stubSelection = (node: Node, text: string) => {
  const removeAllRanges = vi.fn()
  window.getSelection = vi.fn().mockReturnValue({
    isCollapsed: false,
    anchorNode: node,
    focusNode: node,
    toString: () => text,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ top: 120, bottom: 140, left: 20, width: 90, height: 20 }),
    }),
    removeAllRanges,
  } as unknown as Selection)
  return removeAllRanges
}
```

Replace the three selection tests ("opens the vocab form with the selected word…", language prefill, touch selectionchange) so each asserts the pill appears first and the form opens only after clicking it:

```ts
it('shows Add to vocab for a selection and opens the form when it is pressed', async () => {
  stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
  renderDialog()

  const paragraph = await screen.findByText('Le fantôme existait.')
  stubSelection(paragraph, 'fantôme')
  fireEvent.mouseUp(paragraph)

  const pill = await screen.findByRole('button', { name: 'Add to vocab' })
  expect(screen.queryByPlaceholderText('e.g. hund')).toBeNull()
  fireEvent.click(pill)

  await waitFor(() => expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme'))
})

it('captures a whole phrase, not a single word', async () => {
  stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
  renderDialog()

  const paragraph = await screen.findByText('Le fantôme existait.')
  stubSelection(paragraph, 'Le   fantôme existait.')
  fireEvent.mouseUp(paragraph)

  fireEvent.click(await screen.findByRole('button', { name: 'Add to vocab' }))

  await waitFor(() =>
    expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('le fantôme existait.')
  )
})

it('shows the pill from a touch-style selectionchange without mouseup', async () => {
  stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
  renderDialog()

  const paragraph = await screen.findByText('Le fantôme existait.')
  stubSelection(paragraph, 'fantôme')
  fireEvent(document, new Event('selectionchange'))

  const pill = await screen.findByRole('button', { name: 'Add to vocab' })
  fireEvent.click(pill)

  await waitFor(() => expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme'))
})
```

Add these additional tests:

```ts
it('hides the pill when the selection collapses', async () => {
  stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
  renderDialog()

  const paragraph = await screen.findByText('Le fantôme existait.')
  stubSelection(paragraph, 'fantôme')
  fireEvent.mouseUp(paragraph)
  await screen.findByRole('button', { name: 'Add to vocab' })

  window.getSelection = vi.fn().mockReturnValue({ isCollapsed: true } as unknown as Selection)
  fireEvent(document, new Event('selectionchange'))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
  )
})

it('ignores a selection that ends outside the reader', async () => {
  stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
  renderDialog()

  const paragraph = await screen.findByText('Le fantôme existait.')
  stubSelection(paragraph, 'fantôme')
  const selection = window.getSelection() as unknown as { focusNode: Node }
  selection.focusNode = document.body
  fireEvent.mouseUp(paragraph)

  expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
})

it('captures the phrase when the pill is pressed without collapsing the selection', async () => {
  stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
  renderDialog()

  const paragraph = await screen.findByText('Le fantôme existait.')
  stubSelection(paragraph, 'fantôme existait')
  fireEvent.mouseUp(paragraph)

  const pill = await screen.findByRole('button', { name: 'Add to vocab' })
  fireEvent.pointerDown(pill)
  fireEvent.click(pill)

  await waitFor(() =>
    expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme existait')
  )
})
```

Keep the existing pagination, close-control, keyboard, and error tests unchanged.

- [ ] **Step 2: Run the reader tests to verify they fail**

Run: `npx vitest run src/components/books/BookReaderDialog.test.tsx`
Expected: FAIL — the form opens immediately and no `Add to vocab` button exists.

- [ ] **Step 3: Implement the pill**

In `src/components/books/BookReaderDialog.tsx`:

1. Import `getFloatingButtonPosition` from `@/lib/textSelection` and `BookMarked` from `lucide-react`.
2. Add state `const [textSelection, setTextSelection] = useState<{ text: string; top: number; left: number } | null>(null)` and refs `selectionBtnRef` (button) and `contentRef` (`DialogContent`).
3. Replace `openVocabForSelection` with:

```ts
const readTextSelection = useCallback(() => { /* validate + position */ }, [])
const openVocabForSelection = useCallback(() => { /* capture + open */ }, [textSelection])
```

`readTextSelection` returns early and sets `null` when: there is no selection; `sel.isCollapsed`; `anchorNode`/`focusNode` is missing or outside `scrollRef.current`; the whitespace-normalized text is empty; `getRangeAt(0).getBoundingClientRect()` throws or has zero width and height. Otherwise it positions with `getFloatingButtonPosition(rect, window.innerWidth)`, then subtracts `contentRef.current.getBoundingClientRect()` top/left so the absolutely positioned pill sits correctly inside the transformed dialog, clamping to a minimum of 8px. Skip the state write when text, top, and left are unchanged.

`openVocabForSelection` returns early when `textSelection` is null (this also makes double-fired touch/click handlers harmless), then sets `pendingWord`, bumps `vocabSession`, opens the panel, clears `textSelection`, and calls `window.getSelection()?.removeAllRanges()`.

4. Replace the current `selectionchange` effect with one that debounces 200 ms before calling `readTextSelection`, and add `onMouseUp={readTextSelection}` to the scroll container. Remove the old comment about handing a selection straight to the form.
5. Add a `pointerdown` document listener that clears `textSelection` when the target is outside both `scrollRef` and `selectionBtnRef`.
6. In the page-change effect, also call `setTextSelection(null)`. Add `onScroll` to the scroll container that calls `readTextSelection()` only while `textSelection` is set, so the pill stays anchored.
7. Attach `ref={contentRef}` to `DialogContent`.
8. Render the pill as a direct child of `DialogContent` (inside the ready branch is fine) when `textSelection` is set:

```tsx
<button
  ref={selectionBtnRef}
  type="button"
  className="absolute z-[60] flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 touch-manipulation"
  style={{ top: textSelection.top, left: textSelection.left }}
  onPointerDown={(e) => e.preventDefault()}
  onMouseDown={(e) => e.preventDefault()}
  onTouchEnd={(e) => { e.preventDefault(); openVocabForSelection() }}
  onClick={openVocabForSelection}>
  <BookMarked className="h-3.5 w-3.5" />
  Add to vocab
</button>
```

- [ ] **Step 4: Run the reader tests to verify they pass**

Run: `npx vitest run src/components/books/BookReaderDialog.test.tsx`
Expected: PASS, including the untouched pagination, close-control, keyboard, and error tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/books/BookReaderDialog.tsx src/components/books/BookReaderDialog.test.tsx
git commit -m "feat: capture selected phrases in the book reader"
```

---

### Task 3: Books page search

**Files:**
- Modify: `src/pages/Books.tsx`
- Test: `src/pages/Books.test.tsx`

**Interfaces:**
- Consumes: `fetchAllBooks(code)`, `searchBooks(books, query)` from Task 1.
- Produces: no exports. The page's new UI contract is a search box labelled `Search books` and a clear control labelled `Clear search`.

- [ ] **Step 1: Write the failing tests**

Add to `src/pages/Books.test.tsx` a helper for a two-page shelf and the tests below. `stubFetch` already returns 404 for unmatched URLs, so every search page must be stubbed.

```ts
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

it('finds a book that has not been loaded yet as the user types', async () => {
  const fn = stubFetch([...twoPageShelf()])
  renderPage()
  await screen.findByText('Livre 1')

  fireEvent.change(screen.getByLabelText('Search books'), { target: { value: 'candide' } })

  expect(await screen.findByText('Candide, ou l’optimisme')).toBeInTheDocument()
  expect(screen.queryByText('Livre 1')).toBeNull()
  expect(fn.mock.calls.some(([url]) => url === '/books/fr/2.json')).toBe(true)
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
  expect(await screen.findByText('Candide, ou l’optimisme')).toBeNull()
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

  const fn = stubFetch([...twoPageShelf()])
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByText('Candide, ou l’optimisme')).toBeInTheDocument()
  expect(fn).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the page tests to verify they fail**

Run: `npx vitest run src/pages/Books.test.tsx`
Expected: FAIL — there is no search box.

- [ ] **Step 3: Implement the search**

In `src/pages/Books.tsx`:

1. Import `useQuery` alongside `useInfiniteQuery`, `Search` and `X` from `lucide-react`, `Input` from `@/components/ui/input`, and `fetchAllBooks`, `searchBooks` from `@/lib/bookCatalog`.
2. Extract the grid into a local `BookGrid({ books, onRead }: { books: Book[]; onRead: (book: Book) => void })` so the normal and search branches share it.
3. Add `const [query, setQuery] = useState('')`, `const trimmedQuery = query.trim()`, `const searching = trimmedQuery.length > 0`.
4. Add the shelf query:

```ts
const {
  data: shelf = [],
  isLoading: shelfLoading,
  isError: shelfIsError,
  refetch: refetchShelf,
} = useQuery({
  queryKey: ['books', language.code, 'all'],
  queryFn: () => fetchAllBooks(language.code),
  enabled: searching,
  staleTime: 5 * 60 * 1000,
})
```

5. Compute `const results = searching ? searchBooks(shelf, trimmedQuery) : books`.
6. Add the search field to the header controls, before the Shelf label:

```tsx
<div className="relative w-full sm:w-64">
  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input
    type="search"
    aria-label="Search books"
    placeholder="Search title or author…"
    className="h-10 pl-9 pr-9"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
  />
  {query ? (
    <button
      type="button"
      aria-label="Clear search"
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
      onClick={() => setQuery('')}>
      <X className="h-3.5 w-3.5" />
    </button>
  ) : null}
</div>
```

7. Replace the count line:

```tsx
<p className="mono-label mt-4 text-muted-foreground" aria-live="polite">
  {searching
    ? shelfLoading
      ? 'Searching the shelf…'
      : `${results.length} ${results.length === 1 ? 'match' : 'matches'} for “${trimmedQuery}”`
    : `${books.length} loaded · five at a time`}
</p>
```

8. Render the search branch before the existing infinite-query branches:

```tsx
{searching ? (
  shelfLoading ? (
    /* five skeleton cards, same markup as the isLoading branch */
  ) : shelfIsError ? (
    <Card className="mt-8 p-6 text-center">
      <p className="text-sm text-destructive" role="alert">Could not search the shelf.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchShelf()}>Retry</Button>
    </Card>
  ) : results.length === 0 ? (
    <Card className="mt-8 p-6 text-center">
      <p className="text-sm text-muted-foreground">No books match “{trimmedQuery}”.</p>
    </Card>
  ) : (
    <BookGrid books={results} onRead={setReaderBook} />
  )
) : isLoading ? ( ...existing... ) : ...}
```

9. Leave the normal shelf branch (five cards, Load more, empty state, Retry) intact and use `BookGrid` there too. Update the subtitle copy from "Select a word while you read" to "Select a phrase while you read".

- [ ] **Step 4: Run the page tests to verify they pass**

Run: `npx vitest run src/pages/Books.test.tsx`
Expected: PASS, including all pre-existing shelf tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Books.tsx src/pages/Books.test.tsx
git commit -m "feat: search the book shelf"
```

---

### Task 4: Full verification

**Files:** none expected to change.

- [ ] **Step 1: Run the complete test suite**

Run: `npx vitest run`
Expected: PASS for every suite.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors. Fix any that touch the changed files.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build completes.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open `/books`, and confirm: typing filters the shelf with accent-insensitive matches; clearing restores the five-card shelf and Load more; selecting a multi-word phrase in a book shows **Add to vocab**; tapping it opens the form with the full phrase; dragging selection handles does not open the form by itself; page navigation still works.

- [ ] **Step 5: Commit any lint or build fixes**

```bash
git add -A
git commit -m "chore: verify books phrase capture and search"
```

Only commit if Step 2 or 3 required changes.
