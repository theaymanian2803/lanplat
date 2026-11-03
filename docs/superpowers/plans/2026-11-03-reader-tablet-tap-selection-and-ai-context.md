# Reader Tablet Tap-Selection + AI "Add to Context" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On tablets, select book words by tapping (no native copy menu) and put the "Add to vocab" pill at the selected line's left edge; let every AI answer append itself to the vocab form's Context Note.

**Architecture:** The reader keeps its desktop native-selection path and adds a coarse-pointer path driven by `touchstart`/`touchend`, `getWordRangeAtPoint`, and two new pure helpers in `src/lib/textSelection.ts`. `TutorChat` gains an optional callback, and `AddWordPanel` wires that callback into its existing context-note state.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, Vitest, React Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-11-03-reader-tablet-tap-selection-and-ai-context-design.md`

## Global Constraints

- No new dependencies.
- Desktop (fine pointer) reader selection must stay visually and behaviorally unchanged.
- Touch selection never creates a native `Selection`; the reader text uses `select-none` and `[-webkit-touch-callout:none]` on coarse pointers.
- Tap tolerance is 10 px of finger movement.
- The pill keeps the existing accessible name `Add to vocab` and the existing open-form behavior.
- Context notes append with a blank line when the field already has text.
- Do not touch `VocabBank.tsx`, `Translate.tsx`, `StudyRoom.tsx`, or `TranscriptStrip.tsx`.
- Verification gate: `npx vitest run <changed test files>` passes and `npx eslint <changed files>` exits 0.

## Review Focus

1. A tap on whitespace, punctuation, or a line gap: must clear the selection or do nothing, never crash or select a neighbouring word.
2. A tap that becomes a scroll (finger moved more than 10 px): must not select anything.
3. A phrase that spans two paragraphs or several text nodes: merge and highlight every line correctly.
4. A selection at the top or bottom edge of the reader: the pill must stay inside the reader band and remain pressable.
5. Adding a second AI answer when the context note already has text: preserve the old text, insert one blank line, and do not append the same answer twice.

---

### Task 1: Selection helpers

**Files:**
- Modify: `src/lib/textSelection.ts`
- Test: `src/lib/textSelection.test.ts`

**Interfaces:**
- Consumes: existing `getWordAtOffset`, `getWordRangeAtPoint`.
- Produces:
  - `mergeWordRanges(anchor: Range, other: Range): Range`
  - `getLineStartButtonPosition(rects: Array<{ top: number; bottom: number; left: number }>, bounds: { top: number; left: number; width: number; height: number }, size?: { width: number; height: number }): { top: number; left: number }`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/textSelection.test.ts`:

```ts
import {
  getFloatingButtonPosition,
  getLineStartButtonPosition,
  getWordAtOffset,
  getWordRangeAtPoint,
  isDoubleTap,
  mergeWordRanges,
} from '@/lib/textSelection'

describe('mergeWordRanges', () => {
  const setup = (text: string) => {
    const container = document.createElement('div')
    container.textContent = text
    document.body.appendChild(container)
    return container
  }

  const rangeFor = (node: Node, start: number, end: number) => {
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    return range
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('covers both words in document order', () => {
    const container = setup('Hunden løber hurtigt')
    const node = container.firstChild as Text
    const merged = mergeWordRanges(rangeFor(node, 0, 6), rangeFor(node, 7, 12))

    expect(merged.toString()).toBe('Hunden løber')
  })

  it('works when the second word comes before the anchor', () => {
    const container = setup('Hunden løber hurtigt')
    const node = container.firstChild as Text
    const merged = mergeWordRanges(rangeFor(node, 7, 12), rangeFor(node, 0, 6))

    expect(merged.toString()).toBe('Hunden løber')
  })

  it('merges words that live in different paragraphs', () => {
    const container = document.createElement('div')
    const first = document.createElement('p')
    first.textContent = 'Le fantôme'
    const second = document.createElement('p')
    second.textContent = 'existait ici'
    container.append(first, second)
    document.body.appendChild(container)

    const merged = mergeWordRanges(
      rangeFor(first.firstChild as Text, 0, 2),
      rangeFor(second.firstChild as Text, 0, 8),
    )

    expect(merged.toString()).toContain('Le fantôme')
    expect(merged.toString()).toContain('existait')
  })
})

describe('getLineStartButtonPosition', () => {
  const bounds = { top: 100, left: 50, width: 700, height: 400 }

  it('sits below the last line and aligns to the first line start', () => {
    const rects = [
      { top: 150, bottom: 170, left: 120 },
      { top: 180, bottom: 200, left: 90 },
    ]

    expect(getLineStartButtonPosition(rects, bounds)).toEqual({ top: 208, left: 120 })
  })

  it('moves above the first line when there is no room below', () => {
    const rects = [{ top: 460, bottom: 480, left: 120 }]

    expect(getLineStartButtonPosition(rects, bounds)).toEqual({ top: 416, left: 120 })
  })

  it('clamps the button inside the reader band', () => {
    const rects = [{ top: 150, bottom: 170, left: 5 }]

    expect(getLineStartButtonPosition(rects, bounds)).toEqual({ top: 178, left: 58 })
  })

  it('falls back to the top-left corner when there are no line rects', () => {
    expect(getLineStartButtonPosition([], bounds)).toEqual({ top: 108, left: 58 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/textSelection.test.ts`
Expected: FAIL because `mergeWordRanges` and `getLineStartButtonPosition` are not exported.

- [ ] **Step 3: Implement the helpers in `src/lib/textSelection.ts`**

```ts
export interface LineRect {
  top: number
  bottom: number
  left: number
}

export interface Band {
  top: number
  left: number
  width: number
  height: number
}

export function mergeWordRanges(anchor: Range, other: Range): Range {
  const doc = anchor.ownerDocument ?? other.ownerDocument
  const merged = doc.createRange()
  const anchorFirst = anchor.compareBoundaryPoints(Range.START_TO_START, other) <= 0
  const start = anchorFirst ? anchor : other
  const end = anchorFirst ? other : anchor
  merged.setStart(start.startContainer, start.startOffset)
  merged.setEnd(end.endContainer, end.endOffset)
  return merged
}

export function getLineStartButtonPosition(
  rects: LineRect[],
  bounds: Band,
  size = { width: 128, height: 36 },
): { top: number; left: number } {
  const padding = 8
  const minLeft = bounds.left + padding
  const maxLeft = Math.max(minLeft, bounds.left + bounds.width - size.width - padding)
  if (rects.length === 0) return { top: bounds.top + padding, left: minLeft }

  const first = rects[0]
  const last = rects[rects.length - 1]
  const left = Math.min(Math.max(first.left, minLeft), maxLeft)
  const below = last.bottom + padding
  const above = first.top - size.height - padding
  const maxTop = Math.max(bounds.top + padding, bounds.top + bounds.height - size.height - padding)
  const top = below + size.height <= bounds.top + bounds.height - padding ? below : above

  return { top: Math.min(Math.max(top, bounds.top + padding), maxTop), left }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/textSelection.test.ts`
Expected: PASS, including the existing `getFloatingButtonPosition` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/textSelection.ts src/lib/textSelection.test.ts
git commit -m "feat: add touch selection helpers for the book reader"
```

---

### Task 2: Tablet tap-selection in the book reader

**Files:**
- Modify: `src/components/books/BookReaderDialog.tsx`
- Test: `src/components/books/BookReaderDialog.test.tsx`

**Interfaces:**
- Consumes: `mergeWordRanges`, `getLineStartButtonPosition`, `getWordRangeAtPoint`, `useCoarsePointer`.
- Produces: no new exports; internal `touchSelection` state and handlers.

- [ ] **Step 1: Write the failing tests**

In `src/components/books/BookReaderDialog.test.tsx`, add a helper near the existing stubs:

```ts
const makeCoarsePointer = () => {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: query.includes('pointer: coarse'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

const stubCaretAt = (node: Node, offsets: number[]) => {
  let call = 0
  Object.defineProperty(document, 'caretRangeFromPoint', {
    configurable: true,
    value: () => {
      const range = document.createRange()
      range.setStart(node, offsets[Math.min(call++, offsets.length - 1)])
      range.collapse(true)
      return range
    },
  })
}

const stubLineRects = (rects: Array<{ top: number; bottom: number; left: number; width: number; height: number }>) => {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => rects,
  })
}

const tap = (target: Element, x = 20, y = 120) => {
  fireEvent.touchStart(target, { touches: [{ clientX: x, clientY: y }] })
  fireEvent.touchEnd(target, { changedTouches: [{ clientX: x, clientY: y }] })
}
```

Add tests inside the `describe('BookReaderDialog', ...)` block:

```ts
it('selects a word on a tap without a native selection and shows the pill at the line start', async () => {
  const restore = makeCoarsePointer()
  try {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubCaretAt(paragraph.firstChild as Node, [3])
    stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])
    stubRect(screen.getByRole('dialog'), {
      top: 100,
      left: 50,
      bottom: 700,
      right: 850,
      width: 800,
      height: 600,
    })
    stubRect(paragraph.closest('.reader-scroll') as Element, {
      top: 150,
      left: 60,
      bottom: 650,
      right: 760,
      width: 700,
      height: 500,
    })

    tap(paragraph)

    const pill = await screen.findByRole('button', { name: 'Add to vocab' })
    expect(pill.style.left).toBe('90px')
    fireEvent.click(pill)

    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('le fantôme')
    )
  } finally {
    restore()
  }
})

it('extends a tap selection to a phrase and starts over on the next tap', async () => {
  const restore = makeCoarsePointer()
  try {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubCaretAt(paragraph.firstChild as Node, [3, 8, 3])
    stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])
    stubRect(paragraph.closest('.reader-scroll') as Element, {
      top: 150,
      left: 60,
      bottom: 650,
      right: 760,
      width: 700,
      height: 500,
    })

    tap(paragraph, 20, 120)
    tap(paragraph, 80, 120)

    fireEvent.click(await screen.findByRole('button', { name: 'Add to vocab' }))
    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('le fantôme existait.')
    )
  } finally {
    restore()
  }
})

it('ignores a touch that moves far enough to be a scroll', async () => {
  const restore = makeCoarsePointer()
  try {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubCaretAt(paragraph.firstChild as Node, [3])
    fireEvent.touchStart(paragraph, { touches: [{ clientX: 20, clientY: 120 }] })
    fireEvent.touchEnd(paragraph, { changedTouches: [{ clientX: 20, clientY: 180 }] })

    expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
  } finally {
    restore()
  }
})

it('clears the touch selection when the reader scrolls or the page changes', async () => {
  const restore = makeCoarsePointer()
  try {
    stubFetch({ ok: true, text: async () => MULTI_CHAPTER_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubCaretAt(paragraph.firstChild as Node, [3])
    stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])
    tap(paragraph)
    await screen.findByRole('button', { name: 'Add to vocab' })

    fireEvent.scroll(paragraph.closest('.reader-scroll') as Element)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
    )

    stubCaretAt(paragraph.firstChild as Node, [3])
    tap(paragraph)
    await screen.findByRole('button', { name: 'Add to vocab' })
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    expect(await screen.findByText('On ne le croyait pas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
  } finally {
    restore()
  }
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/books/BookReaderDialog.test.tsx`
Expected: FAIL — the new coarse-pointer tests find no pill or the old bottom-bar test still expects `reader-selection-bar`.

- [ ] **Step 3: Implement the coarse-pointer path in `BookReaderDialog.tsx`**

Changes:

1. Imports:

```ts
import {
  getFloatingButtonPosition,
  getLineStartButtonPosition,
  getWordRangeAtPoint,
  mergeWordRanges,
} from '@/lib/textSelection'
```

2. Add state and refs next to the existing selection state:

```ts
interface TouchRect { top: number; bottom: number; left: number; width: number; height: number }
interface TouchSelection {
  text: string
  anchor: Range
  rects: TouchRect[]
  isPhrase: boolean
  pillTop: number
  pillLeft: number
}

const [touchSelection, setTouchSelection] = useState<TouchSelection | null>(null)
const touchStartRef = useRef<{ x: number; y: number } | null>(null)
```

3. Make the desktop selection reader return early on coarse pointers:

```ts
const readTextSelection = useCallback(() => {
  if (coarsePointer) return
  // ...existing body unchanged...
}, [coarsePointer])
```

4. Add the tap handlers:

```ts
const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
  const touch = e.touches[0]
  touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
}, [])

const handleTouchEnd = useCallback(
  (e: React.TouchEvent<HTMLDivElement>) => {
    if (!coarsePointer) return
    const container = scrollRef.current
    const content = contentRef.current
    const start = touchStartRef.current
    touchStartRef.current = null
    const touch = e.changedTouches[0]
    if (!container || !content || !start || !touch) return
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) return

    const word = getWordRangeAtPoint(container, touch.clientX, touch.clientY)
    if (!word) {
      setTouchSelection(null)
      return
    }

    let nextRange: Range
    let isPhrase = false
    if (!touchSelection || touchSelection.isPhrase) {
      nextRange = word.range
    } else {
      nextRange = mergeWordRanges(touchSelection.anchor, word.range)
      isPhrase = true
    }

    const text = nextRange.toString().replace(/\s+/g, ' ').trim()
    if (!text) {
      setTouchSelection(null)
      return
    }

    const contentRect = content.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const clientRects =
      typeof nextRange.getClientRects === 'function' ? Array.from(nextRange.getClientRects()) : []
    const rects = clientRects
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        top: r.top - contentRect.top,
        bottom: r.bottom - contentRect.top,
        left: r.left - contentRect.left,
        width: r.width,
        height: r.height,
      }))
    if (rects.length === 0) {
      const fallback = word.range.getBoundingClientRect()
      rects.push({
        top: fallback.top - contentRect.top,
        bottom: fallback.bottom - contentRect.top,
        left: fallback.left - contentRect.left,
        width: fallback.width,
        height: fallback.height,
      })
    }

    const pill = getLineStartButtonPosition(rects, {
      top: containerRect.top - contentRect.top,
      left: containerRect.left - contentRect.left,
      width: containerRect.width,
      height: containerRect.height,
    })

    setTouchSelection({
      text,
      anchor: isPhrase ? touchSelection!.anchor : word.range.cloneRange(),
      rects,
      isPhrase,
      pillTop: pill.top,
      pillLeft: pill.left,
    })
    window.getSelection()?.removeAllRanges()
  },
  [coarsePointer, touchSelection],
)
```

5. Clear the touch selection on page change and on outside presses:

```ts
// inside the existing `useEffect` that runs on `[page]`
setTouchSelection(null)
```

```ts
// inside the existing pointerdown dismiss handler
if (scrollRef.current && !scrollRef.current.contains(target)) {
  setTextSelection(null)
  setTouchSelection(null)
}
```

6. Update `openVocabForSelection` to read the active selection:

```ts
const openVocabForSelection = useCallback(() => {
  const text = coarsePointer ? touchSelection?.text : textSelection?.text
  if (!text) return
  setPendingWord(text)
  setVocabSession((s) => s + 1)
  setVocabOpen(true)
  setTextSelection(null)
  setTouchSelection(null)
  window.getSelection()?.removeAllRanges()
}, [coarsePointer, textSelection, touchSelection])
```

7. Update the scroll handler and text container:

```tsx
onScroll={() => {
  if (coarsePointer) setTouchSelection(null)
  else if (textSelection) readTextSelection()
}}
onTouchStart={handleTouchStart}
onTouchEnd={handleTouchEnd}
onContextMenu={(e) => {
  if (coarsePointer) e.preventDefault()
}}
className={`reader-scroll min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 ${
  coarsePointer ? 'select-none [-webkit-touch-callout:none]' : ''
}`}
```

8. Replace the old coarse-pointer bottom bar with highlights and a left-aligned pill. Keep the desktop branch unchanged:

```tsx
{coarsePointer && touchSelection ? (
  <>
    {touchSelection.rects.map((rect, i) => (
      <div
        key={i}
        aria-hidden
        className="pointer-events-none absolute z-[55] rounded-sm bg-primary/20"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />
    ))}
    <button
      ref={selectionBtnRef}
      type="button"
      data-testid="reader-touch-pill"
      className="absolute z-[60] flex touch-manipulation items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
      style={{ top: touchSelection.pillTop, left: touchSelection.pillLeft }}
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onTouchEnd={(e) => {
        e.preventDefault()
        openVocabForSelection()
      }}
      onClick={openVocabForSelection}>
      <BookMarked className="h-4 w-4" />
      Add to vocab
    </button>
  </>
) : !coarsePointer && textSelection ? (
  <button
    ref={selectionBtnRef}
    type="button"
    className="absolute z-[60] flex touch-manipulation items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
    style={{ top: textSelection.top, left: textSelection.left }}
    onPointerDown={(e) => e.preventDefault()}
    onMouseDown={(e) => e.preventDefault()}
    onTouchEnd={(e) => {
      e.preventDefault()
      openVocabForSelection()
    }}
    onClick={openVocabForSelection}>
    <BookMarked className="h-3.5 w-3.5" />
    Add to vocab
  </button>
) : null}
```

9. Update the `sr-only` status line:

```tsx
{touchSelection || textSelection
  ? 'Phrase selected. Press Add to vocab to save it.'
  : ''}
```

10. Delete the old `reader-selection-bar` bottom-bar test and replace it with the new tap tests from Step 1. The old test is the one named `puts the selection button in a bottom bar on coarse-pointer devices`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/books/BookReaderDialog.test.tsx`
Expected: PASS. Desktop tests still pass, the new tap tests pass, and no test references `reader-selection-bar`.

- [ ] **Step 5: Run lint on the changed files**

Run: `npx eslint src/components/books/BookReaderDialog.tsx src/components/books/BookReaderDialog.test.tsx src/lib/textSelection.ts src/lib/textSelection.test.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/books/BookReaderDialog.tsx src/components/books/BookReaderDialog.test.tsx
git commit -m "feat: tap-select book words on tablets without the copy menu"
```

---

### Task 3: "Add to context" on AI answers

**Files:**
- Modify: `src/components/ai/TutorChat.tsx`
- Modify: `src/components/AddWordPanel.tsx`
- Create: `src/components/ai/TutorChat.test.tsx`
- Modify: `src/components/AddWordPanel.test.tsx`

**Interfaces:**
- Consumes: existing `askTutor`, `TutorTurn`, `AutoGrowTextarea`.
- Produces: `TutorChatProps.onAddToContext?: (text: string) => void`.

- [ ] **Step 1: Write the failing TutorChat test**

Create `src/components/ai/TutorChat.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import TutorChat from '@/components/ai/TutorChat'
import { askTutor } from '@/lib/aiChat'

vi.mock('@/lib/aiChat', () => ({
  askTutor: vi.fn(),
}))

describe('TutorChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds an assistant answer to the context through the callback', async () => {
    vi.mocked(askTutor).mockResolvedValue('A long explanation.')
    const onAddToContext = vi.fn()
    render(
      <TutorChat
        context={{ word: 'hund', answerLanguage: 'English' }}
        onAddToContext={onAddToContext}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Explain this word' }))

    expect(await screen.findByText('A long explanation.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add this answer to the context note' }))

    expect(onAddToContext).toHaveBeenCalledWith('A long explanation.')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add this answer to the context note' })
      ).toBeDisabled()
    )
  })

  it('does not render the context action without a callback', async () => {
    vi.mocked(askTutor).mockResolvedValue('A long explanation.')
    render(<TutorChat context={{ word: 'hund', answerLanguage: 'English' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Explain this word' }))
    await screen.findByText('A long explanation.')

    expect(
      screen.queryByRole('button', { name: 'Add this answer to the context note' })
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Write the failing AddWordPanel test**

Add to `src/components/AddWordPanel.test.tsx`:

```tsx
vi.mock('@/lib/aiChat', () => ({
  askTutor: vi.fn().mockResolvedValue('A long explanation.'),
}))

it('appends an AI answer to the existing context note', async () => {
  renderPanel('hund')
  fireEvent.change(screen.getByPlaceholderText('Where you encountered this word'), {
    target: { value: 'chapter 1' },
  })

  fireEvent.click(screen.getByRole('button', { name: 'Ask AI about this word' }))
  fireEvent.click(screen.getByRole('button', { name: 'Explain this word' }))
  await screen.findByText('A long explanation.')
  fireEvent.click(screen.getByRole('button', { name: 'Add this answer to the context note' }))

  expect(screen.getByPlaceholderText('Where you encountered this word')).toHaveValue(
    'chapter 1\n\nA long explanation.'
  )
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/ai/TutorChat.test.tsx src/components/AddWordPanel.test.tsx`
Expected: FAIL — `onAddToContext` is not a prop and the button does not exist.

- [ ] **Step 4: Implement `onAddToContext` in `TutorChat.tsx`**

1. Add `useState` for added answers and the icon import:

```ts
import { Check, Loader2, Plus, Send, Sparkles, X } from 'lucide-react'
```

```ts
interface TutorChatProps {
  context: TutorContext
  onClose?: () => void
  className?: string
  /** Called with an assistant answer when the learner chooses to keep it. */
  onAddToContext?: (text: string) => void
}
```

2. Add state:

```ts
const [addedAnswers, setAddedAnswers] = useState<Set<number>>(() => new Set())
```

3. Render the action under assistant bubbles. Keep the bubble text and add a button below it:

```tsx
{messages.map((message, index) => (
  <div
    key={index}
    className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
      message.role === 'user'
        ? 'ml-auto bg-primary text-primary-foreground'
        : 'bg-muted text-foreground'
    }`}>
    <p className="whitespace-pre-wrap">{message.content}</p>
    {message.role === 'assistant' && onAddToContext ? (
      <button
        type="button"
        aria-label="Add this answer to the context note"
        disabled={addedAnswers.has(index)}
        onClick={() => {
          onAddToContext(message.content)
          setAddedAnswers((prev) => new Set(prev).add(index))
        }}
        className="mt-1.5 flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60">
        {addedAnswers.has(index) ? (
          <Check className="h-3 w-3" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
        {addedAnswers.has(index) ? 'Added' : 'Add to context'}
      </button>
    ) : null}
  </div>
))}
```

- [ ] **Step 5: Wire the callback in `AddWordPanel.tsx`**

Add the handler next to `handleClear`:

```ts
const appendToContext = (text: string) => {
  setContextNote((prev) => {
    const trimmed = prev.trim()
    return trimmed ? `${trimmed}\n\n${text}` : text
  })
  toast.success('Added to context')
}
```

Pass it to the chat:

```tsx
<TutorChat
  context={{
    word: word.trim() || undefined,
    language: wordLang,
    answerLanguage: translationLanguage,
    note: contextNote.trim() || undefined,
  }}
  onClose={() => setChatOpen(false)}
  onAddToContext={appendToContext}
  className="mt-1 max-h-80"
/>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/ai/TutorChat.test.tsx src/components/AddWordPanel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: PASS. If an unrelated pre-existing failure appears, confirm it also fails on `git stash` and leave it alone.

- [ ] **Step 8: Run lint on the changed files**

Run: `npx eslint src/components/ai/TutorChat.tsx src/components/ai/TutorChat.test.tsx src/components/AddWordPanel.tsx src/components/AddWordPanel.test.tsx`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/components/ai/TutorChat.tsx src/components/ai/TutorChat.test.tsx src/components/AddWordPanel.tsx src/components/AddWordPanel.test.tsx
git commit -m "feat: add AI answers to the vocab context note"
```

---

## Self-Review Notes

- Spec coverage: tablet tap selection (Task 2), left-edge pill (Tasks 1–2), no native menu (Task 2), Add to context in every vocab form that has Ask AI (Task 3), desktop unchanged (Task 2), edge cases (Review Focus tests in Tasks 1–3).
- Type consistency: `mergeWordRanges` and `getLineStartButtonPosition` signatures match between Tasks 1 and 2; `onAddToContext` matches between Tasks 3's TutorChat and AddWordPanel steps.
- No new dependencies; Vocab Bank, Translate, Study Room, and the transcript strip are untouched.
