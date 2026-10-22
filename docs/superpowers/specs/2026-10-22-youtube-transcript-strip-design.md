# YouTube Transcript Strip

Date: 2026-10-22

## Context

The Study Room plays YouTube videos and already supports selecting text (in text-mode items
and books) to hand a word to the Vocab Bank. Videos, however, are opaque: the learner hears a
word but cannot see or select it. Every video in the workflow has captions, so the missing
piece is access to the caption text.

The player's IFrame API exposes caption track metadata only, never the words. YouTube's
official Data API can download captions only for videos the owner controls. The readable text
comes from the caption track behind YouTube's InnerTube player response, which must be read
server-side because of CORS and bot checks. The repository already has a Vercel function
pattern for this in `api/book-text.ts`.

## Decisions (approved)

1. The transcript is a rolling multi-line strip directly under the video, replacing the
   speed / A-B control row. Speed and A-B move into a `...` popover in the strip header.
2. Clicking a cue pauses the video and seeks to that cue. The cue stays highlighted while the
   vocabulary form is open.
3. Selecting a word (drag or double-tap) inside a cue opens the existing Add Word form with
   the word in the Word field and `"<cue text>" — <timestamp>` in the Context Note.
4. Saving the word closes the form and resumes playback only if the video was playing when the
   cue was clicked. Closing the form without saving leaves the video paused.
5. Captions come from a self-hosted Vercel proxy (no vendor, no API key). Failures degrade to
   an inline message with Retry; the rest of the Study Room is unaffected.
6. Text-mode items, books, notes, screenshots and the width controls are unchanged.

## 1. Caption pipeline

### Endpoint

`GET /api/transcript?videoId=<11-char id>&lang=<code>`

Success (`200`):

```json
{
  "videoId": "abc123DEF45",
  "languageCode": "da",
  "isGenerated": true,
  "tracks": [{ "code": "da", "name": "Danish (auto-generated)", "generated": true }],
  "cues": [{ "start": 12.4, "dur": 2.8, "text": "jeg har aldrig set noget lignende" }]
}
```

Failures return `{ "error": string, "reason": "invalid-id" | "no-captions" | "upstream" }`
with `400`, `404` or `502`.

### Fetch chain (`api/_transcript.ts`)

1. Validate the video id (`^[A-Za-z0-9_-]{11}$`).
2. POST `youtubei/v1/player` with the ANDROID client context to read
   `captions.playerCaptionsTracklistRenderer.captionTracks`.
3. If that yields no tracks, GET the watch page and brace-scan `"captionTracks":` out of
   `ytInitialPlayerResponse` as a fallback.
4. Pick a track: exact language code (manual before ASR), then any manual track, then the
   first track.
5. Fetch the signed `baseUrl` with `&fmt=json3`; normalize events to `{start, dur, text}`.
   Fall back to the XML formats (`<p t d>` srv3, `<text start dur>` srv1) when JSON is
   unavailable. Collapse consecutive duplicate lines and handle `aAppend` events.
6. Return cues plus a de-duplicated track list (one entry per language code, manual preferred).

Each upstream call has a 12 s timeout. The handler exports `maxDuration = 60` and sets
`Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`.

### Dev server

`vite dev` does not run Vercel functions. `vite.config.ts` gains a `configureServer` middleware
that mounts `/api/transcript` and calls the same exported `fetchTranscript`. One implementation,
two entry points.

### Client cache

`src/lib/youtubeTranscript.ts` reads `transcript:<videoId>:<code>` through the existing
`cacheGet` / `cacheSet` helpers before calling the endpoint. Only successful payloads are
cached. A stale cache version is discarded by the existing `CACHE_VERSION` mechanism.

## 2. Transcript strip

`src/components/TranscriptStrip.tsx`, rendered in place of `VideoControls` under the player.

- Header: captions icon, `Transcript` label, track `Select` when more than one track exists,
  an `auto` badge for generated captions, a `Jump to current` chip when the user has scrolled
  away, and a `...` popover containing the existing `VideoControls` (speed + A-B loop).
- Body: `~148px` scroll container of cue buttons. Each row shows a mono timestamp and the text.
  The active row uses a primary left border plus `bg-primary/10`.
- The component owns a 250 ms interval reading `playerRef.getCurrentTime()` and re-renders only
  itself. StudyRoom does not tick.
- Auto-scroll centers the active row. `wheel` / `touchmove` disables following until
  `Jump to current` is pressed.
- Clicking a row calls `onSeekPause(cue.start)` and freezes that row. Keyboard Enter/Space does
  the same. The freeze clears when the vocabulary form closes.
- Drag selection is read from `selectionchange`; touch double-tap uses `getWordRangeAtPoint`.
  Both pause via `onPause`, freeze the containing cue, and show the same floating "Add word"
  button used elsewhere. The context is `cueContext(cue)`.
- States: three skeleton lines while loading; `No captions for this video.` for an empty
  result; the error message plus a Retry button for a failed fetch.

## 3. Vocabulary handoff

`AddWordPanel` gains:

- `initialContext?: string` — seeded into the Context Note and reset with the word.
- `onSaved?: () => void` — called after the insert succeeds and the form clears.

`StudyRoom` adds `pendingContext`, `wasPlayingRef`, and three callbacks:

- `pauseForCapture()` — records whether the player was playing, then pauses.
- `pauseAtForCapture(seconds)` — same, then seeks.
- `handleWordSaved()` — closes the panel and resumes when `wasPlayingRef` is set.

`wasPlayingRef` clears whenever the player reports playing, and when the form closes without a
save, so a later manual pause cannot trigger an unexpected resume.

## 4. Testing

- `api/transcript.test.ts`: handler validation, successful JSON3 normalization, no-captions
  response, `parseJson3` (`aAppend`, empty segments, duplicates), `parseXmlCues` (srv3 and
  srv1), `pickTrack` preference order, `summarizeTracks` de-duplication,
  `extractCaptionTracksFromHtml`.
- `src/lib/youtubeTranscript.test.ts`: language-code mapping and `findActiveCueIndex`
  boundaries.
- Manual: play a video with manual captions, one with auto captions, one without captions;
  click a cue, select a word, save, confirm resume; close the form and confirm it stays paused.

## Out of scope

- Caption translation (`tlang`), editing transcripts, storing transcripts in Turso, and a
  paste-a-transcript fallback.
- Static-host transcript support (the strip reports the endpoint is unavailable there).
