# Books: phrase selection and shelf search

Date: 2026-10-30

## Context

`/books` lists Project Gutenberg titles from static JSON (five per page, 40 per language:
French, Spanish, Swedish, Danish) and opens `BookReaderDialog` to read the plain text.

Today the reader treats any settled text selection as a word to capture: `mouseup` and a
debounced `selectionchange` both call `openVocabForSelection`, which immediately opens
`AddWordPanel` and clears the selection. On a tablet this fires while the reader is still
dragging selection handles, so only one word can be captured and longer phrases cannot.

The books page has no way to find a title; the learner can only page through the shelf.

## Goals

1. Selecting text in the reader never opens the form by itself. A floating **Add to vocab**
   button appears after the selection settles; tapping it captures the whole selection
   (word, phrase, or sentence) and opens the existing form pre-filled.
2. The books page can search the current language's shelf by title or author, filtering as
   the user types, accent-insensitively.
3. Reading, pagination, language switching, and the existing vocabulary flow keep working.

## Non-goals

- Changing the Study Room / transcript selection behavior.
- Searching across all languages at once, or searching book contents.
- Calling an external catalogue API.
- Multi-selection (discontiguous phrases).

## Approach (approved)

Search the whole shelf: the first keystroke loads the remaining static pages for the current
language through one cached query (40 tiny books), then filters locally. The alternative of
filtering only the five loaded cards misses most titles; Gutendex would add a network
dependency the static catalogue was built to avoid.

## Reader: selection handoff

`BookReaderDialog` mirrors the pattern already proven in `StudyRoom.tsx`:

- `textSelection: { text, top, left } | null` state, a `selectionBtnRef`, and the existing
  `getFloatingButtonPosition` helper from `src/lib/textSelection.ts`.
- `readTextSelection()` requires a non-collapsed selection whose anchor and focus are both
  inside the scroll container, normalizes whitespace, and positions the button from
  `range.getBoundingClientRect()`. A collapsed or outside selection clears the button.
- `selectionchange` is coalesced through a short timer (touch long-press never fires
  `mouseup`); `mouseup` on the reader reads the selection immediately.
- The floating pill renders `position: fixed`, `z-index` above the dialog, with
  `Add to vocab` and a bookmark icon. `pointerdown` is prevented so tapping it does not
  collapse the selection before capture.
- Pressing the pill copies `textSelection.text` into `pendingWord`, bumps `vocabSession`,
  opens the panel, clears the button, and then removes the browser selection.
- The button is hidden on page change, on a pointer press outside the reader, and when a new
  selection collapses. Scrolling the reader re-reads the selection so the pill stays anchored.
- No change to `AddWordPanel` itself; multi-word text simply lands in the Word field.

## Books: shelf search

`src/lib/bookCatalog.ts` gains:

- `fetchAllBooks(code)` — walks `/books/<code>/1.json`, `2.json`, … until `hasMore` is false.
- `normalizeForSearch(value)` — lowercase plus NFD diacritic stripping (`é` → `e`).
- `searchBooks(books, query)` — matches the normalized title or either author form
  (`Leroux, Gaston` and `Gaston Leroux`), returns the original order, and returns the full
  list for a blank query.

`src/pages/Books.tsx` gains a search field beside the Shelf selector:

- Controlled query state; `searchBooks` runs on every change (40 items, no debounce needed).
- When the query is non-empty, a `useQuery(['books', code, 'all'])` calls `fetchAllBooks`
  and the grid renders the matches. The infinite query is still used for the normal shelf.
- While the shelf loads, the count line shows a small spinner and the grid is not replaced by
  a premature "no results" message. A failed shelf load shows the existing error card pattern
  with Retry.
- The count line reads `N matches for “query”` while searching; the Load more button is
  hidden. An empty match set says `No books match “query”.`
- Clearing the field restores the five-card shelf exactly as it is today.

## Testing

- `BookReaderDialog.test.tsx`: selection shows the pill instead of the form; tapping the pill
  opens the form with the full phrase; collapsed selection shows nothing; language prefill and
  touch `selectionchange` still pass (after clicking the pill).
- `Books.test.tsx`: typing filters across pages fetched from `/books/<code>/N.json`;
  accent-insensitive match; author match; clear restores the shelf; empty state; search fetch
  failure with Retry.
- `bookCatalog.test.ts`: `fetchAllBooks` page walking, `normalizeForSearch`, `searchBooks`
  title/author/blank behavior.

## Out of scope

- Persisting the search query in the URL.
- Prefetching the full shelf before the user searches.
- Highlighting the selected text after the form closes.
