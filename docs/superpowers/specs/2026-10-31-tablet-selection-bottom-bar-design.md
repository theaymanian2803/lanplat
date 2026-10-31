# Book reader — selection button at the bottom on touch devices

Date: 2026-10-31
Status: awaiting approval

## Problem

In the book reader, selecting a phrase shows an "Add to vocab" pill floating 10px
above or below the selection (`getFloatingButtonPosition` in
`src/lib/textSelection.ts`). On a tablet, the browser's native selection menu
(Copy / Look Up / Translate) appears in that same area and covers the pill, so
the learner cannot press it.

A page cannot suppress the native selection menu. The fix is to stop placing our
button near the selection on touch devices.

## Chosen approach

**Bottom bar on touch devices (tablet + phone).** While a phrase is selected, the
button renders as a strip pinned to the bottom edge of the reader dialog.
Desktop (mouse) keeps today's floating pill, unchanged.

Rejected: tablet-only gating (leaves the same problem on phones); clamping the
floating pill to the bottom (still overlaps text and the OS menu can flip down
onto it).

## Design

- **Detection** — new `src/hooks/use-coarse-pointer.ts`, `useCoarsePointer()`:
  true when `matchMedia('(pointer: coarse)')` matches or `navigator.maxTouchPoints > 0`.
  Subscribes to media-query changes; returns false when `matchMedia` is absent
  (jsdom default). No width breakpoint, so the behavior is about input type, not
  screen size.
- **Placement** — when touch is detected, `readTextSelection` keeps all existing
  "is this selection inside the reader?" checks but skips the coordinate math.
- **Presentation** — inside `DialogContent`, a bottom overlay:
  `absolute inset-x-0 bottom-0 z-[60] flex justify-center border-t bg-card/95 px-4 py-3 backdrop-blur`,
  with `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))`. The existing
  pill styling and handlers (pointerdown/mousedown preventDefault, touchEnd,
  click, `aria` label "Add to vocab") move into this container.
  `data-testid="reader-selection-bar"` for tests.
- **Overlay, not reflow** (my call): the bar floats over the last text lines
  instead of shrinking the scroll area. Appearing/disappearing during a
  drag-selection must not reflow the text under the finger.
- **Interaction unchanged** — tapping opens `AddWordPanel` prefilled with the
  phrase and clears the selection; pointerdown outside the reader dismisses;
  collapsing the selection hides the bar. When the vocab panel opens the
  selection is already cleared, so bar and panel never stack.

## Non-goals

- Study Room's fixed "Add word" pill — separate screen, not in scope.
- Suppressing or restyling the native selection menu.
- Any change to desktop mouse behavior.
- Changing the reader's chapter navigation or text layout.

## Acceptance criteria

1. On a coarse-pointer device, selecting text shows "Add to vocab" centered at
   the bottom of the reader dialog, clear of the native selection menu.
2. Pressing it opens the vocab form prefilled with the selected phrase and
   clears the selection, exactly as today.
3. Selecting, scrolling, collapsing, and dismissing behave as today on both
   input types.
4. Desktop (fine pointer) is visually unchanged.
5. `npm run test`, `tsc --noEmit`, and `eslint` pass; a new test covers the
   coarse-pointer path.

Size: small change. No builder check.
