# Media Items: Video + Text Study Content

Date: 2026-09-04

## Context

The app currently supports a single kind of study content: YouTube videos. The Dashboard's
"Add Video" button collects a YouTube URL, title, and language. Each item opens in the Study
Room (`/video/:id`), which provides a centered video player plus: pen/drawing overlay, vocab
word panel, lesson-content panel, timestamped notes, and timestamped screenshots.

Users want a second kind of study content: **text pages**. A user should be able to paste an
entire text (a page), open it in the Study Room, and use the exact same features (pen, vocab,
screenshots, notes, lesson content). The text must be presented in the same centered container
with the same 16:9 proportions as the video, must be selectable/copyable, and must not break
any existing video behavior.

## Decisions (approved)

1. **Same 16:9 box**: text renders inside the same container the video uses (same width rules,
   centered, breakout-width controls still work), with internal scroll. Copy button + selectable text.
2. **No timestamps for text**: notes and screenshots attach to the text without time badges;
   clicking a note badge does nothing in text mode (there is no timeline).
3. **Text preview on dashboard card**: text items show title + first ~3 lines as preview,
   document accent — no fake thumbnail.

## 1. Data model

The `videos` table becomes generic media storage. No table renames; existing consumers keep
working.

Schema changes (`SCHEMA_SQL` + migration in `ensureSchema`):

- `videos.youtube_url` — becomes nullable (text items have no URL).
- `videos.media_type` — `TEXT NOT NULL DEFAULT 'video'`, values `'video' | 'text'`.
- `videos.content` — `TEXT` (nullable). Holds the pasted text for `media_type='text'`;
  `NULL` for videos.

Migration logic (guarded by `PRAGMA table_info(videos)`):

- Add `media_type` if missing (existing rows get `'video'` via DEFAULT).
- Add `content` if missing.

Type changes (`src/integrations/turso/types.ts`):

```ts
export interface Video {
  id: string
  user_id: string
  media_type: 'video' | 'text'
  youtube_url: string | null
  content: string | null
  title: string
  language: string
  created_at: string
}
```

DB layer (`src/integrations/turso/db.ts`):

- `videosDb.insert` accepts `{ media_type, youtube_url?, title, language, content? }`.
  Validation (in caller): video requires a valid YouTube URL; text requires non-empty content.
- `videosDb.list` / `videosDb.get` unchanged (SELECT *).

`notes` and `screenshots` tables are unchanged; `video_id` now semantically means
"media id". Their `timestamp` column: text items always store `0`.

## 2. Dashboard (`src/pages/Index.tsx`)

- "Add Video" button → "Add" with a dropdown menu (Video / Text), styled as the current
  primary button.
- Video option → existing dialog (URL, title, language), unchanged, titled "Add Video".
- Text option → new dialog: Title, Language, and a large `AutoGrowTextarea` (or textarea)
  for the text content with a paste hint. Save disabled until title + content present.
- Cards:
  - `media_type === 'video'`: current thumbnail card.
  - `media_type === 'text'`: document-style card — title (link to `/video/:id`), a preview of
    the first ~3 lines of `content` (truncated, muted, `line-clamp-3`), language badge,
    delete button. No play overlay icon; use a file-text icon accent.
- Empty state copy: "No media yet. Add one above." — language filter unchanged.
- Query keys unchanged (`['videos', filter]`, `['videos']`).

## 3. Study Room (`src/pages/StudyRoom.tsx`)

Branch on `video.media_type`:

**Video mode** — exactly today's behavior.

**Text mode**:
- No YouTube API load/player, no `VideoControls` bar, no A-B loop, no seek.
- Keyboard handler: Space / ArrowLeft / ArrowRight shortcuts disabled (still allow Ctrl+Enter
  quick note; note timestamp is 0).
- `currentTime` for notes is always `0`. `openNotePanel` sets `setCurrentTime(0)`.
- `NoteEditor` gets an optional `showTimestamp` (or similar) flag — in text mode the header
  reads "Add Note" without the "at 0:00" suffix.
- Container: same `w-full md:w-[80%] lg:w-[70%] mx-auto` → `w-full` logic and the same
  breakout-width (`outerWidth`) inline styles as the video container.
- Content box: `aspect-video` container (rounded-xl border, like the player frame) with the
  text rendered in a scrollable inner region (overflow-y-auto), reading typography
  (prose-like, comfortable line height, `whitespace-pre-wrap` to preserve pasted line
  breaks), selectable text, plus a small "Copy text" button (copies `video.content` to
  clipboard with toast feedback). Empty content → placeholder message.
- Right-side action buttons: Notes, Add Word, Add Lesson Content, Screenshot, Pen, panel-side
  toggle — all present (identical features).
- Screenshot upload: timestamp 0. Delete works. `NoteList`/`ScreenshotList` in text mode:
  hide the timestamp badge (pass a flag or render nothing when media is text); note badge
  click is a no-op (no `onSeek`).
- Pen overlay: unchanged (works over the whole viewport — same as video).
- Page title and all panels unchanged.

## 4. Related touches

- `src/components/LessonsPanel.tsx` — "Media context" select lists text items too, labeled
  `Text: <title>` (icon FileText); videos keep current label.
- `src/pages/LessonsPage.tsx` — `videoTitles` map renamed to media titles; badge logic:
  `media_type === 'text'` → "Text" badge (FileText icon); video unchanged.
- `src/pages/Languages.tsx` — copy: "Languages added here are available when adding new
  media."
- `src/lib/youtube.ts` — no changes (helpers only used for videos); Study Room guards calls
  behind `media_type === 'video'`.

## 5. Testing

- Unit tests (vitest): add pure-logic helpers where useful (e.g., text preview truncation
  helper if extracted) — keep existing tests green.
- Manual/E2E: video flow unchanged; text flow: add text → card preview → Study Room renders
  text box → copy works → note/screenshot/pen/vocab/lesson panels function → notes &
  screenshots show without badges.
- Typecheck/lint/build must pass (note: pre-existing `videosDb.list` type errors on HEAD are
  out of scope — do not introduce new ones; the `queryFn` wrapper pattern in Index.tsx is
  the safe form).

## Out of scope

- Editing pasted text after creation.
- YouTube URL parsing changes.
- Renaming the `videos` table or `video_id` columns.
- Changing note/screenshot timestamp semantics for videos.