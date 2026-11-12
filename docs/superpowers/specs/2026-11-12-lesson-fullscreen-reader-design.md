# Lesson Full-Screen Reader with Pen and Capture Stack

Date: 2026-11-12

## Intent

The `/lessons` detail view currently shows parts as cards in a 3-column grid. Each card
clamps its content to four lines and offers a **Read more** button that expands it in place.
That is cramped for reading, and there is no way to annotate or capture a word from a lesson.

The learner wants:

1. A compact parts list: one line per part, no **Read more**, no inline expansion.
2. Clicking a part opens the whole lesson in a full-screen reader that fills the viewport.
3. The reader closes only from its own **Close** button (Escape and outside click do nothing).
4. The Study Room's pen (colours, eraser, clear) is available inside the reader.
5. The Study Room's capture stack (Add Note where applicable, Add Vocabulary, Add Lesson
   Content) is available inside the reader.

The `/video` Study Room must keep behaving exactly as it does today.

## Goals

- Compact, hairline-separated part rows on `/lessons` instead of preview cards.
- One edge-to-edge reader dialog for the whole lesson, opened at the part that was clicked.
- A parts rail inside the reader for moving between parts, plus Prev/Next at the bottom.
- One shared pen overlay used by both the Study Room and the lesson reader.
- Add Vocabulary, Add Lesson Content and (when the lesson has a video) Add Note from inside
  the reader, in a side panel that does not cover the content.
- Full keyboard/touch drawing parity with `/video`.

## Non-goals

- Changing the Study Room layout, player, transcript, notes or screenshots.
- Editing lesson content from the reader. Edit/Delete stay on the `/lessons` detail header.
- Screenshots inside the reader: the reader does not display the source media, so a
  screenshot has nothing to capture. Screenshots stay in the Study Room.
- Deep-linkable reader routes. The reader is a dialog on `/lessons`.

## Constraints

- `notesDb` and `screenshotsDb` key rows by media id (`video_id`). A lesson with
  `media_type === 'video'` and a `media_id` can take a note; a text-only lesson cannot, so the
  Add Note action is hidden for it. Add Vocabulary and Add Lesson Content have no media
  dependency.
- The pen overlay must stay inside the dialog. Radix Dialog disables pointer events outside
  its content, so a `fixed` canvas rendered outside the portal would not receive drawing
  input. The reader therefore renders the pen in `contained` mode inside `DialogContent`.
- The reader spans the full viewport, so the content is the scroll container.

## Approach

**Chosen:** extract the Study Room pen into `src/components/PenOverlay.tsx` with two layout
modes (`viewport` for `/video`, `contained` for dialogs). Replace the part grid with compact
rows. Add `src/components/LessonReaderDialog.tsx`: a full-screen Radix dialog containing a
running head, a parts rail, the selected part's blocks, an action rail, and an optional side
panel for Add Word / Add Note / Add Lesson Content.

**Rejected:** keeping the preview cards and only swapping the expander for a dialog (fast,
but duplicates the pen). A dedicated `/lessons/:id/:part` route (deep-linkable, but more
routing, history and close-state plumbing for no requested benefit).

## Reader layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Lesson title · language · N parts                         [Close X]  │  56px
├───────────────┬──────────────────────────────────┬───────────────────┤
│ Parts rail    │ Part content (scrolls)           │ Action rail       │
│ Part 1        │                                  │ [Note] [Word]     │
│ Part 2  ←sel  │  headings, prose, tables         │ [Lesson] [Pen]    │
│ Part 3        │                                  │                   │
│               │  Prev · Part 2 / N · Next        │                   │
└───────────────┴──────────────────────────────────┴───────────────────┘
```

- Dialog content: `inset-0`, `w-screen h-screen`, `max-w-none`, square corners, no border,
  no padding. It is the only scroll container for the page while open.
- `onEscapeKeyDown` and `onInteractOutside` call `preventDefault()`. The default Radix close
  button is off; the header's Close button is the only way out.
- Below `md`, the parts rail collapses to a horizontal scroll strip under the header. Prev/Next
  remain at the bottom.
- The action rail is a vertical column of icon buttons on the right edge:
  - **Note** (`StickyNote`) only when `lesson.media_type === 'video' && lesson.media_id`.
  - **Add Word** (`BookMarked`).
  - **Add Lesson Content** (`Layers`).
  - **Pen** (`P`), highlighted while drawing.
- Opening a panel closes any other panel. The panel is a 320px column between the content and
  the action rail, scrollable, with its own close control. AddWordPanel/NoteEditor/
  AddLessonContentPanel are reused unchanged (NoteEditor gets `showTimestamp={false}`,
  `timestamp={0}`).
- Add Lesson Content receives `defaultLanguage={lesson.language ?? ''}`.
- Switching parts closes nothing; the reader keeps the panel state.

## Pen

`PenOverlay` owns the canvas, stroke history, colour list, eraser, clear, resize/DPR redraw,
pointer capture and its floating control rail. Props:

```ts
interface PenOverlayProps {
  onClose: () => void
  side?: 'left' | 'right'
  mode?: 'viewport' | 'contained'
  topControls?: ReactNode
}
```

- `viewport`: `fixed inset-0` canvas sized to `window`; control rail `fixed` and vertically
  centred on `side`.
- `contained`: `absolute inset-0` inside a `relative` parent, canvas sized to the parent with
  a `ResizeObserver`; control rail `absolute` on `side`.
- The control rail keeps the Study Room order: optional `topControls` (video rewind/play/
  forward), divider, six colour swatches, divider, eraser, clear, close.
- In the reader the pen fills the body below the running head, so the reader's Close button
  stays reachable. The pen's own close button closes only the pen.
- Drawing resets when the overlay mounts, matching today's Study Room behaviour.

StudyRoom replaces its inline drawing state, refs, handlers and overlay JSX with
`<PenOverlay mode="viewport" side={panelSide} topControls={...} onClose={...} />`. The
existing `isDrawingMode` state stays and only controls whether the overlay renders.

## Compact part rows

`LessonDetail` renders `lesson.parts` as one hairline-separated list. Each row:

```
Part 2                                   First line of the part text…   ›
```

- One line, 44–48px tall, full width, hover raises the hairline to the primary border.
- Number in the existing mono label style; snippet in body text, `truncate`.
- Snippet source: first non-table block's text collapsed to a single line; if the part starts
  with a table (or has no text), join the table headers, else "Empty part".
- Clicking the row opens the reader at that part. No `line-clamp`, no Read more, no inline
  expansion, no table preview on the list.
- The small box/card shape is gone; this is a dense list per `DESIGN.md`.

Extract the snippet logic as `partSnippet(part: Part): string` in `src/lib/lessonTree.ts` so
it is unit-testable.

## Files

- `src/components/PenOverlay.tsx` — new shared drawing overlay.
- `src/components/LessonReaderDialog.tsx` — new full-screen reader.
- `src/pages/StudyRoom.tsx` — use `PenOverlay`, remove the inlined drawing implementation.
- `src/pages/LessonsPage.tsx` — compact part rows, open the reader, remove the accordion.
- `src/lib/lessonTree.ts` — add `partSnippet`.
- `src/test/lessons.test.ts` — cover `partSnippet`.
- `src/components/LessonReaderDialog.test.tsx` — new: close button closes; Escape and
  outside click do not; parts switch; Add Note hidden without video media.

## Verification

- `npm test` (vitest) passes, including the new snippet and reader tests.
- `npm run lint` passes.
- `npm run build` succeeds.
- Manual: `/lessons` → lesson → part row → reader is edge-to-edge; Escape/outside click keep
  it open; Close closes it; parts rail and Prev/Next move content; Add Word saves to the Vocab
  Bank; Add Lesson Content appends; pen draws, erases, clears, closes; `/video` pen still
  draws with video transport controls.
