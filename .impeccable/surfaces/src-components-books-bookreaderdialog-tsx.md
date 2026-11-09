# Surface: Book reader (`src/components/books/BookReaderDialog.tsx`)

Mode: Read. Related: `src/pages/Books.tsx`, `src/components/AddWordPanel.tsx`, `src/index.css`, `tailwind.config.ts`.

## Scope

Opened from the Books shelf. Public-domain prose in French, Spanish, Swedish or Danish, fetched through the Gutenberg proxy and split into chapters. The surface's job is to hold a long reading session and hand a selected word to the vocab form with the book's language intact. Existing behavior preserved: chapter paging (buttons + arrow keys), touch tap/drag selection, desktop floating pill, Ask AI handoff, retry/empty states.

## Audience and constraints

- User: one self-directed adult learner, laptop first, tablet/phone second, reading for 20–60 minutes.
- Job: read comfortably, then capture a phrase without losing the page.
- Success: the reader feels like a printed book on the study desk and the capture action never breaks the page.
- Must stay untouched: all selection logic, keyboard paging, AI tutor context, Gutenberg proxy, and the rest of the app's dark carrel chrome.
- Would feel wrong: a card with a header bar, a dark panel re-skinned, decorative gradients or shadows, a serif applied to UI chrome.

## Direction contract

THESIS: A book page, not a text panel. The reading surface refuses the app's card-and-header arrangement and becomes one full-bleed enamel sheet with printed furniture; the world's industrial chrome survives only in the running head, folio and counters.

OWN-WORLD: enamel `#e9e2d1` ground, ink `#1b1d16`, 1px hairline rules; signal orange for the one capture action only; Spectral for prose, Archivo for chapter titles and the running head, Courier Prime for the folio and labels; 2–4px corners; no shadows, no gradients. Language ink survives as a 2px dot in the running head.

STORY: The learner opens a book and sees a real page — running head, chapter opener, drop cap, folio. They settle into a 68ch measure. Selecting a phrase raises the capture bar at the foot of the page; on desktop the vocab form opens as a margin note and the page narrows rather than being covered.

FIRST VIEWPORT: full-bleed sheet, top reading-progress hairline; 56px running head with an 8px language dot, book title, Ask AI and Close; chapter title at `clamp(1.85rem, 3.6vw, 2.9rem)` over a 56px rule; prose at 19px/1.78 in a 68ch measure with a two-line drop cap on the first substantial paragraph; a capture bar over the foot on touch; 44px folio row with Prev · page x/y · Next.

FORM: single printed sheet, chosen from printed page / open spread / full-bleed; full-bleed per the user's pick. Position 3 of 3 on that list. seed: none (unavailable).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Memorable moment

The chapter opener: a heavy Archivo title, a short rule, then the drop cap pulling the eye into the French prose; later, the margin note sliding in on a tonal step while the page reflows instead of being covered.

## Unresolved

- Verse and epigraph blocks are reflowed into paragraphs; a dedicated verse treatment is future work.
- The touch selection pill still floats over the next line (existing geometry, unchanged).
