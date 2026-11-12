# Lesson Full-Screen Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/lessons` part cards into compact rows that open a full-screen whole-lesson reader with a parts rail, capture stack and the Study Room pen.

**Architecture:** Extract the pen overlay into a shared `PenOverlay` with `viewport` and `contained` modes. Add a `LessonReaderDialog` built on the existing Radix `Dialog`, and reduce `LessonDetail` to a one-line-per-part list that opens it. Add a pure `partSnippet` helper for the row preview.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Radix Dialog, TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-lesson-fullscreen-reader-design.md`

## Global Constraints

- `/video` Study Room behavior must not change: same colours, eraser, clear, resize/DPR behavior, control order and video transport.
- Reader dialog fills the viewport (`inset-0`, `w-screen`, `h-screen`, no max width, square, no border) and closes only from its Close button.
- `onEscapeKeyDown` and `onInteractOutside` are prevented.
- Add Note renders only when `lesson.media_type === 'video' && lesson.media_id`.
- Screenshots and content editing stay out of the reader.
- Reuse existing components: `AddWordPanel`, `AddLessonContentPanel`, `NoteEditor`, `LessonBlocks`, `TableBlock`.
- Follow the existing visual language: hairline borders, 4px corners, mono labels, no shadows beyond what the components already carry.

## Review Focus

- Drawing in the reader after the dialog opens/closes: the canvas must size to its container, survive resize, and reset strokes on mount.
- Escape and outside click while drawing: they must not close the reader or drop the pen unexpectedly.
- A lesson with zero parts: the reader still opens, shows an empty state, and Close works.
- A lesson with no language: Add Word opens with a usable default and no blank Select option.
- A lesson tied to a text/book media: Add Note stays hidden because the media id is not a video.

---

### Task 1: Part snippet helper

**Files:**
- Modify: `src/lib/lessonTree.ts`
- Test: `src/test/lessons.test.ts`

**Interfaces:**
- Produces: `partSnippet(part: Part): string`

- [ ] **Step 1: Write the failing tests**

Add to `src/test/lessons.test.ts`:

```ts
import { buildLessonTree, partSnippet } from '@/lib/lessonTree'
import { createBlock, createTableBlock, serializeBlocks } from '@/lib/lessonBlocks'

describe('partSnippet', () => {
  it('returns the first non-table block text on one line', () => {
    const content = serializeBlocks([
      createBlock('h1', '  Verbs\n  and tenses '),
      createBlock('p', 'second'),
    ])
    expect(partSnippet({ ...part('p', 'l'), content })).toBe('Verbs and tenses')
  })

  it('falls back to table headers when the part has no text blocks', () => {
    const content = serializeBlocks([
      createTableBlock(['Infinitive', 'Present'], [['at spise', 'spiser']]),
    ])
    expect(partSnippet({ ...part('p', 'l'), content })).toBe('Infinitive · Present')
  })

  it('returns Empty part for empty content', () => {
    expect(partSnippet({ ...part('p', 'l'), content: '[]' })).toBe('Empty part')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/test/lessons.test.ts`
Expected: FAIL because `partSnippet` is not exported.

- [ ] **Step 3: Implement `partSnippet` in `src/lib/lessonTree.ts`**

```ts
export function partSnippet(part: Part): string {
  const blocks = parseBlocks(part.content)
  const text = blocks.find((block) => block.type !== 'table' && block.text.trim())
  if (text) return text.text.replace(/\s+/g, ' ').trim()
  const headers = blocks.find((block) => block.type === 'table' && block.table)?.table?.headers
  if (headers?.length) return headers.filter(Boolean).join(' · ')
  return 'Empty part'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/test/lessons.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lessonTree.ts src/test/lessons.test.ts
git commit -m "feat: add lesson part snippet helper"
```

---

### Task 2: Shared PenOverlay

**Files:**
- Create: `src/components/PenOverlay.tsx`
- Modify: `src/pages/StudyRoom.tsx`

**Interfaces:**
- Produces: `PenOverlay` default export with props `{ onClose: () => void; side?: 'left' | 'right'; mode?: 'viewport' | 'contained'; topControls?: ReactNode }`.

- [ ] **Step 1: Create `PenOverlay`**

Move the Study Room drawing implementation verbatim into a component:

- State: `strokeColor`, `isEraser`.
- Refs: `canvasRef`, `hostRef`, `strokesRef`, `drawingRef`.
- Mount effect resets strokes, sizes the canvas to `window` in `viewport` mode or to `hostRef` in `contained` mode, applies DPR, redraws, and listens to `window.resize` plus a guarded `ResizeObserver` in contained mode.
- Pointer handlers keep `setPointerCapture`, 3px lines, 24px eraser, `destination-out`.
- `clearCanvas` resets strokes and clears.
- Wrapper/canvas classes:
  - `viewport`: wrapper `fixed inset-0 z-[100]`, canvas `absolute inset-0 h-full w-full touch-none cursor-crosshair`.
  - `contained`: wrapper `absolute inset-0 z-20`, same canvas classes.
- Rail classes:
  - `viewport`: `fixed top-1/2 -translate-y-1/2 z-[110]` and `right-0`/`left-0`.
  - `contained`: `absolute top-1/2 -translate-y-1/2 z-30` and `right-2`/`left-2`.
  - Same black/60 glass rail, colour swatches, eraser, clear, close.
- Render `topControls` in a `flex flex-col gap-1.5 items-center` block followed by a divider when provided.

- [ ] **Step 2: Replace the Study Room pen implementation**

Delete `DRAW_COLORS`, `strokeColor`, `isEraser`, `canvasRef`, `strokesRef`, `drawingRef`, the drawing effect, `getCanvasPoint`, `handlePointerDown/Move/Up`, and `clearCanvas` from `StudyRoom.tsx`. Keep `isDrawingMode`.

Replace the inline pen JSX with:

```tsx
{isDrawingMode && (
  <PenOverlay
    mode="viewport"
    side={panelSide}
    onClose={() => setIsDrawingMode(false)}
    topControls={
      <>
        <Button size="icon" title="Rewind 10s" onClick={rewind} className="h-8 w-8 rounded-lg bg-white/10 text-white hover:bg-white/25 transition-colors">
          <Rewind className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          title={isPlaying ? 'Pause' : 'Play'}
          onClick={togglePlay}
          className={`h-9 w-9 rounded-lg transition-colors ${isPlaying ? 'bg-white/10 text-white hover:bg-white/25' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" title="Skip Forward 10s" onClick={skipForward} className="h-8 w-8 rounded-lg bg-white/10 text-white hover:bg-white/25 transition-colors">
          <Forward className="h-4 w-4" />
        </Button>
      </>
    }
  />
)}
```

Remove now-unused imports (`Eraser`, `Trash2`, `X`), keep `Rewind`, `Play`, `Pause`, `Forward`.

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc -b --pretty false` and `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PenOverlay.tsx src/pages/StudyRoom.tsx
git commit -m "refactor: share the study room pen overlay"
```

---

### Task 3: Lesson reader dialog

**Files:**
- Create: `src/components/LessonReaderDialog.tsx`
- Test: `src/components/LessonReaderDialog.test.tsx`

**Interfaces:**
- Consumes: `partSnippet` (not required), `PenOverlay`, `LessonBlocks`, `AddWordPanel`, `AddLessonContentPanel`, `NoteEditor`.
- Produces: default export `LessonReaderDialog` with props `{ lesson: NestedLesson; initialPartId: string; onClose: () => void }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/LessonReaderDialog.test.tsx` with a QueryClient wrapper and a two-part fixture built from `createBlock`/`serializeBlocks`. Cover:

- The initial part's text renders and the lesson title is present.
- Clicking **Part 2** in the parts rail swaps the content.
- `fireEvent.keyDown(document, { key: 'Escape' })` leaves the dialog mounted.
- Clicking **Close** calls `onClose`.
- **Add Note** is absent for `media_type: null` and present for `media_type: 'video', media_id: 'v1'`.

Mock `@/integrations/turso/db` with `lessonsDb`, `languagesDb`, `vocabularyDb`, `notesDb` stubs so imported panels do not hit a real database.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/LessonReaderDialog.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `LessonReaderDialog`**

Structure:

```tsx
const [selectedPartId, setSelectedPartId] = useState(initialPartId)
const [panel, setPanel] = useState<'note' | 'word' | 'lesson' | null>(null)
const [pen, setPen] = useState(false)
const index = Math.max(0, lesson.parts.findIndex((p) => p.id === selectedPartId))
const part = lesson.parts[index]
const language = lesson.language ?? getTargetLanguage() ?? 'Danish'
const hasVideo = lesson.media_type === 'video' && !!lesson.media_id
```

- `Dialog open` + `onOpenChange={(o) => { if (!o) onClose() }}`.
- `DialogContent` with `showCloseButton={false}`, `onEscapeKeyDown`/`onInteractOutside` preventing default, and `className="left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-background p-0 data-[state=open]:animate-none data-[state=closed]:animate-none"`.
- `DialogTitle`/`DialogDescription` as `sr-only`.
- Header: title, language + part count, **Close** button.
- Body `relative flex min-h-0 flex-1`:
  - Desktop parts rail `hidden w-60 shrink-0 overflow-y-auto border-r border-border p-2 md:block`; each part is a full-width button with `Part N`, a truncated snippet and a selected state.
  - Mobile parts strip `flex gap-2 overflow-x-auto border-b border-border p-2 md:hidden` with the same selection.
  - Content `main` scrolls, renders `<LessonBlocks blocks={parseBlocks(part.content)} />` in `mx-auto max-w-[75ch]`, then Prev / `Part x / N` / Next.
  - Optional side panel between content and rail: `absolute inset-0 z-10 w-full overflow-y-auto bg-background p-4 md:static md:w-80 md:shrink-0 md:border-l md:border-border`.
  - Action rail `flex w-14 shrink-0 flex-col items-center gap-2 border-l border-border py-3`: Note (video only), Word, Lesson, Pen.
  - Empty lesson state with its own message.
  - `<PenOverlay mode="contained" side="right" onClose={() => setPen(false)} />` last, so it covers the body only and leaves the header Close reachable.

Panel rendering:

```tsx
{panel === 'note' && hasVideo && (
  <NoteEditor videoId={lesson.media_id!} timestamp={0} showTimestamp={false} onClose={() => setPanel(null)} />
)}
{panel === 'word' && (
  <AddWordPanel defaultLanguage={language} onClose={() => setPanel(null)} position="right" widthClassName="w-full" />
)}
{panel === 'lesson' && (
  <AddLessonContentPanel defaultLanguage={language} onClose={() => setPanel(null)} position="right" />
)}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/LessonReaderDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LessonReaderDialog.tsx src/components/LessonReaderDialog.test.tsx
git commit -m "feat: add full-screen lesson reader"
```

---

### Task 4: Compact parts list on `/lessons`

**Files:**
- Modify: `src/pages/LessonsPage.tsx`

**Interfaces:**
- Consumes: `partSnippet`, `LessonReaderDialog`.

- [ ] **Step 1: Replace the part grid**

- Remove `expandedParts`, `togglePart`, `parseBlocks`, `LessonBlocks`, `TableBlock` imports and the `ChevronDown` import.
- Keep `LessonDetail`'s header, back button, edit and delete.
- Render parts as a hairline list:

```tsx
<div className="border-y border-border/60">
  {lesson.parts.map((part, idx) => (
    <button
      key={part.id}
      type="button"
      onClick={() => setOpenPartId(part.id)}
      className="group flex w-full items-center gap-4 border-b border-border/60 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30">
      <span className="mono-label w-14 shrink-0 text-muted-foreground">Part {idx + 1}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">{partSnippet(part)}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
    </button>
  ))}
</div>
```

- Add `const [openPartId, setOpenPartId] = useState<string | null>(null)` and render the dialog only when a part is open:

```tsx
{openPartId && (
  <LessonReaderDialog
    lesson={lesson}
    initialPartId={openPartId}
    onClose={() => setOpenPartId(null)}
  />
)}
```

- Add `ChevronRight` to the lucide import; drop unused imports so lint passes.

- [ ] **Step 2: Verify types, lint and tests**

Run: `npx tsc -b --pretty false`, `npm run lint`, `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LessonsPage.tsx
git commit -m "feat: open lessons in a full-screen reader"
```

---

### Task 5: Full verification

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Manual checks**

- `/lessons` → a lesson with parts shows one-line rows and no Read more.
- Opening a row fills the viewport; Escape and backdrop clicks do nothing; Close returns to the lesson.
- The parts rail and Prev/Next move between parts.
- Add Word saves to the Vocab Bank; Add Lesson Content appends; Add Note appears only for video lessons.
- Pen draws, erases, clears and closes; the header Close stays reachable.
- `/video` pen still shows the video transport and draws identically.
