# Book reader tablet tap-selection + "Add to context" on AI replies

Date: 2026-11-03
Status: awaiting approval

## Context

In the book reader on a coarse-pointer device (tablet or phone), selecting text uses the
browser's native selection. The native Copy / Look Up / Translate menu appears over the
reader and makes selection awkward, and the "Add to vocab" action is pinned to the bottom
centre of the dialog, so the learner has to reach into the middle of the screen.

The Ask AI panel in the vocabulary form returns explanations, but there is no way to keep an
answer with the word. The learner has to copy the answer and paste it into the Context Note
field by hand.

## Goals

1. On a coarse-pointer device, tapping a word selects it with our own highlight, so the
   browser never opens its copy menu. A second tap on another word extends the selection to a
   phrase; a third tap starts a new selection. The "Add to vocab" button appears at the left
   edge of the selected line, where the line starts, instead of at the bottom centre.
2. Desktop (fine pointer) keeps today's native selection and floating pill, unchanged.
3. Every AI answer in the vocab form's Ask AI panel gets an "Add to context" action that
   appends the answer to the Context Note field. This works anywhere `AddWordPanel` is used
   (book reader and Study Room).

## Non-goals

- Drag-to-extend, selection handles, or discontiguous multi-selection on touch.
- Suppressing or restyling the native selection menu on desktop.
- Adding Ask AI to the Vocab Bank or Translate forms, which do not have it today.
- Changing the reader's text layout, pagination, or keyboard navigation.

## Chosen approach

### Tablet selection (tap, not native)

A page cannot suppress the native selection menu while native selection is active, so on
coarse-pointer devices the reader stops using native selection entirely:

- The reader text gets `select-none` and `[-webkit-touch-callout:none]`; a coarse-pointer
  `contextmenu` is prevented. This is the same pattern already used in `StudyRoom.tsx`.
- `touchstart` records the finger position; `touchend` treats movement of 10 px or less as a
  tap and resolves the word under the finger with the existing `getWordRangeAtPoint`.
- Selection state becomes `{ text, anchorRange, rects, isPhrase }`:
  - no selection → select the tapped word;
  - a single-word selection → merge the anchor and tapped ranges into one phrase;
  - a phrase selection → start a new selection at the tapped word.
- The selection is drawn as absolutely positioned highlight boxes from
  `range.getClientRects()`, converted into `DialogContent` coordinates (the dialog is
  transformed, so fixed positioning is not reliable there).
- Scrolling or changing the page clears the touch selection.
- The pill is absolutely positioned at the first line's left edge, just below the last
  selected line when there is room in the reader, otherwise above the first line, clamped
  inside the dialog. It keeps the existing "Add to vocab" label, bookmark icon, and handlers.
- The desktop path (`mouseup` + debounced `selectionchange` + `getFloatingButtonPosition`)
  is untouched and early-returns on coarse pointers.

New helpers in `src/lib/textSelection.ts`, unit-tested directly:

- `mergeWordRanges(anchor, other)` — returns a range covering both words in document order.
- `getLineStartButtonPosition(rects, containerRect, size)` — left-aligned placement below
  the last line, or above the first line when there is no room, clamped to the container.

### "Add to context" on AI replies

- `TutorChat` gains an optional `onAddToContext?: (text: string) => void`.
- Each assistant bubble gets a small ghost button, "Add to context", with an accessible
  label. Pressing it passes that answer's text to the callback.
- `AddWordPanel` supplies the callback and appends the answer to `contextNote`, separated by
  a blank line when the field already has text, then shows a success toast. The field stays
  editable and saving is unchanged.
- Vocab Bank and Translate have no Ask AI panel, so nothing is added there.

## Acceptance criteria

1. On a coarse-pointer device, tapping a word highlights it and shows "Add to vocab" at the
   left edge of that line; no native copy menu appears.
2. Tapping a second word extends the highlight to the phrase; tapping a third starts a new
   single-word selection. Pressing the pill opens the form with the full selected text.
3. Scrolling, changing pages, or tapping outside the reader clears the touch selection.
4. Desktop selection and pill placement are visually unchanged.
5. In the vocab form, each AI answer has "Add to context"; pressing it appends the answer to
   the Context Note field, preserving any existing text.
6. `npm run test`, `tsc --noEmit`, and `eslint` pass on the changed files.

Size: small-to-medium change. No builder check.
