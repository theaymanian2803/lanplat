# Docked AI chat widget

Date: 2026-11-09
Status: implemented

## Context

Ask AI is the single global tutor surface (`AiTutorPanel`), rendered once inside
`Layout`. It opens as a right-hand `Sheet` that covers the page. On `/video/:id`
that sheet hides the add-vocabulary form the learner is working in, so looking a
word up interrupts capture. The form itself also carries a small "Ask AI" pill,
which duplicates the global entry point.

Pages and forms already register live context with the tutor store
(`useRegisterAiTutor`): the video title/transcript, the book page, the Vocab Bank
row, and the add-word form's word, translation, language and note. `TutorChat`
already renders "Add to context" on each answer and calls the registered form
callback.

## Goals

1. Remove the "Ask AI" pill from `AddWordPanel` (Study Room and book reader).
2. Replace the right-hand sheet with a website-style chat widget: an orange,
   fixed bubble at the bottom-right of every route, opening a chat card that
   slides up from the bottom and floats above the bubble.
3. Keep the page and the add-word form visible and usable while the chat is open
   (no full-screen overlay, no focus trap).
4. Keep the existing context model: route label as a fallback, page/video/book
   context when registered, and the live add-word form fields while it is open.
5. Keep "Add to context" on AI answers appending to the form's context note.
6. Keep the other Ask AI entry points (sidebar, mobile header, Vocab Bank rows,
   book reader button) working; they all open the same chat widget.

## Non-goals / anti-goals

- No drag-to-resize, snap points, or multiple simultaneous chats.
- No server-side chat history; a reload starts a new conversation.
- Not changing the `/api/chat` contract, prompts, or model.
- Not adding new AI entry points to pages that have none today.

## Chosen approach

**Docked bubble + floating chat card.** Presented alternatives were a true modal
bottom sheet (rejected: its overlay blocks the form) and a full-width docked
panel (rejected: still covers the lower part of the page). The chosen widget is
non-modal.

### Bubble

- Fixed `bottom-right`, above the safe-area inset, `z-[90]`.
- Orange gradient (`orange-500 → amber-500`), white message icon, "Ask AI" label
  on `sm+`, rounded-full, shadow, hover lift.
- Visible on every route in `App`, including `/` (landing) and the access-code
  screen, because the tutor is client-side and the public landing page already
  loads without database access.
- While the chat is open the same button becomes an orange close (X) toggle.

### Chat card

- Fixed above the bubble: `right`/`left` inset by 0.75rem on mobile, `w-[400px]`
  on `sm+`; height `min(70dvh, 600px)`; rounded-2xl, `bg-card`, primary/orange
  border, heavy shadow, `animate-in slide-in-from-bottom-*`.
- Header: orange sparkle, "Ask AI", answer-language chip, one-line context
  summary, close button.
- Body: existing `TutorChat` with `showHeader={false}` and the registered
  `onAddToContext`.
- `role="dialog"` with an accessible label; Escape closes it. No overlay, no
  focus trap, page scrolling and the form stay available.
- The conversation stays mounted/open across client-side route changes (like a
  website chat widget); the context summary and the next request update with the
  new route/form.

### Context

- New `AiTutorDock` uses `useLocation` to derive a human label from the path
  (`/dashboard` → "Dashboard", `/vocab` → "Vocabulary Bank", `/video/…` →
  "Study Room", `/` → "Landing page", etc.).
- The effective request context is `{ ...registeredContext, title:
  registeredContext.title ?? routeLabel }`, so a page/form that registers a real
  title still wins and pages without a registration are still located.
- `AddWordPanel`'s existing registration keeps supplying the live word,
  translation, language, answer language and note; no new plumbing.
- `AddWordPanel` drops its Sparkles pill and `openAiTutor` import; registration
  and `appendToContext` stay.

### Mounting

- `AiTutorDock` lives in `App.tsx` inside `BrowserRouter`, next to the routes, so
  it survives route changes and is available on the public landing page.
- `Layout` stops rendering `AiTutorPanel`; `AiTutorPanel.tsx` is replaced by the
  dock.
- `openAiTutor()` / `closeAiTutor()` keep their signatures, so the Navbar, Vocab
  Bank, book reader and flashcard entry points need no changes.

## Tests

- `AddWordPanel`: no "Ask AI" button inside the form; the empty context note
  still gets an AI answer appended; live fields still reach `askTutor`.
- New `AiTutorDock`: bubble opens the chat; route label appears when no page
  context exists; page/form context overrides the label; close toggle works.
- Update the existing `AiTutorPanel` imports in Vocab Bank and book-reader tests.

## Acceptance criteria

1. The add-word form (video and book reader) has no Ask AI control.
2. An orange fixed bubble appears bottom-right on landing and every app route.
3. Tapping it opens a non-blocking chat card that slides up from the bottom and
   keeps the page and the add-word form usable.
4. With the add-word form open and filled, the chat header reads `About "word" ·
   Language` and the request carries word, translation, language and note.
5. "Add to context" appends the answer to the form's context note exactly as
   today.
6. Sidebar, mobile header, Vocab Bank, book reader and flashcard Ask AI buttons
   open the same widget.
7. `vitest`, `tsc`, `eslint` and `vite build` pass.

Size: small-to-medium change. No builder check.
