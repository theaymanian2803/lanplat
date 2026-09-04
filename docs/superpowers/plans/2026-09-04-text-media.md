# Video + Text Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add either a YouTube video or a pasted text page as study media, with the Study Room's full feature set (pen, vocab, notes, screenshots, lesson content) working for both.

**Architecture:** The existing `videos` table becomes generic media storage via `media_type` + `content` columns (no renames). The Dashboard's "Add Video" button becomes an "Add" dropdown with Video/Text dialogs. StudyRoom branches on `media_type`: video keeps today's player/controls, text renders a 16:9 scrollable reading box with a copy button and timestamp-less notes/screenshots.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, Turso/libsql (web client), Tailwind, shadcn/ui, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-text-media-design.md`

## Global Constraints

- No renames of the `videos` table, `video_id` columns, or `notes`/`screenshots` tables.
- `notes`/`screenshots` store `timestamp = 0` for text media; UI hides the badge in text mode.
- Text renders in the same container rules as video: `w-full md:w-[80%] lg:w-[70%] mx-auto` when no side panel is open, `w-full` when a panel is open, plus the existing `outerWidth` breakout styles.
- Do NOT introduce new `tsc` errors. The repo has pre-existing errors at `LessonsPanel.tsx` and `LessonsPage.tsx` for `queryFn: videosDb.list` — leave those exact lines untouched. Use the wrapper form `queryFn: async () => videosDb.list(...)` for new code.
- Verification commands: `npm run test` (vitest), `npx eslint <files>`, `npx tsc -b tsconfig.app.json` (only the pre-existing errors may appear), `npm run build`.
- No unit-test framework exists for pages/db layers in this repo — their test cycle is typecheck + lint + build + manual smoke described per task. Pure logic (none extracted here) would use vitest.

---

### Task 1: Data model — media_type + content

**Files:**
- Modify: `src/integrations/turso/types.ts` (Video interface)
- Modify: `src/integrations/turso/db.ts` (SCHEMA_SQL videos table, `ensureSchema` migration, `videosDb.insert`)
- Modify: `src/pages/Index.tsx` (single call site of `videosDb.insert` — keep build green)

**Interfaces:**
- Consumes: existing `getTursoClient()` from `./client`, `newId()`/`now()` helpers in db.ts.
- Produces: `Video` gains `media_type: 'video' | 'text'`, `youtube_url: string | null`, `content: string | null`. `videosDb.insert(input: { media_type: 'video' | 'text'; youtube_url: string | null; title: string; language: string; content: string | null })`.

- [ ] **Step 1: Update the Video type**

In `src/integrations/turso/types.ts`, replace the `Video` interface:

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

- [ ] **Step 2: Update the videos table in SCHEMA_SQL**

In `src/integrations/turso/db.ts`, replace the videos table block inside `SCHEMA_SQL` (currently lines ~10-17) with:

```sql
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  youtube_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'video',
  content TEXT,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

- [ ] **Step 3: Add the migration to ensureSchema**

In `src/integrations/turso/db.ts` `ensureSchema()`, after the existing `lessonCols` block (the `ALTER TABLE lessons ADD COLUMN language TEXT` part) and before the legacy-parts block, insert:

```ts
const videoCols = await turso.execute('PRAGMA table_info(videos)')
if (!videoCols.rows.some((c) => c.name === 'media_type')) {
  await turso.execute("ALTER TABLE videos ADD COLUMN media_type TEXT NOT NULL DEFAULT 'video'")
}
if (!videoCols.rows.some((c) => c.name === 'content')) {
  await turso.execute('ALTER TABLE videos ADD COLUMN content TEXT')
}
```

- [ ] **Step 4: Update videosDb.insert**

In `src/integrations/turso/db.ts`, replace `videosDb.insert` with:

```ts
async insert(input: {
  media_type: 'video' | 'text'
  youtube_url: string | null
  title: string
  language: string
  content: string | null
}): Promise<void> {
  await turso.execute({
    sql: 'INSERT INTO videos (id, user_id, youtube_url, media_type, content, title, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      newId(),
      LOCAL_USER_ID,
      input.youtube_url,
      input.media_type,
      input.content,
      input.title,
      input.language,
      now(),
    ],
  })
},
```

- [ ] **Step 5: Fix the call site in Index.tsx**

In `src/pages/Index.tsx`, inside the `addVideo` mutation, change the `videosDb.insert` call to:

```ts
await videosDb.insert({
  media_type: 'video',
  youtube_url: newUrl,
  title: newTitle,
  language: newLang,
  content: null,
})
```

- [ ] **Step 6: Verify**

Run: `npx tsc -b tsconfig.app.json`
Expected: only the pre-existing `videosDb.list` queryFn errors in `LessonsPanel.tsx`/`LessonsPage.tsx` (and their knock-on errors in those files). No new errors in `types.ts`, `db.ts`, `Index.tsx`.

Run: `npm run test`
Expected: all 32 existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/integrations/turso/types.ts src/integrations/turso/db.ts src/pages/Index.tsx
git commit -m "feat: media_type + content columns on videos table"
```

---

### Task 2: Dashboard — Add dropdown, text dialog, text cards

**Files:**
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `Video.media_type`, `videosDb.insert` from Task 1; existing `languagesDb`, `extractVideoId`, `getThumbnailUrl`.
- Produces: Add dropdown with "Add Video"/"Add Text" actions; text dialog saving via `videosDb.insert({ media_type: 'text', youtube_url: null, content: <pasted text>, ... })`; text card branch on `v.media_type === 'text'`.

- [ ] **Step 1: Add imports**

In `src/pages/Index.tsx`, add to the lucide-react import: `FileText`. Add a shadcn dropdown-menu import block:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
```

- [ ] **Step 2: Add text-dialog state**

In the `Index` component, next to the existing `dialogOpen`/`newUrl` state, add:

```ts
const [textDialogOpen, setTextDialogOpen] = useState(false)
const [newText, setNewText] = useState('')
```

- [ ] **Step 3: Add the addText mutation**

After the existing `addVideo` mutation, add:

```ts
const addText = useMutation({
  mutationFn: async () => {
    const content = newText.trim()
    if (!content) throw new Error('Text content is required')
    await videosDb.insert({
      media_type: 'text',
      youtube_url: null,
      title: newTitle.trim(),
      language: newLang,
      content,
    })
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['videos'] })
    setTextDialogOpen(false)
    setNewText('')
    setNewTitle('')
    toast.success('Text added')
  },
  onError: (e) => toast.error(e.message),
})
```

- [ ] **Step 4: Replace the Add button with a dropdown**

Replace the header button (keep `data-tour="add-video"` on the trigger):

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="gap-2 text-sm font-semibold" data-tour="add-video">
      <Plus className="h-4 w-4" />
      Add
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => setDialogOpen(true)} className="gap-2">
      <Play className="h-4 w-4" />
      Add Video
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setTextDialogOpen(true)} className="gap-2">
      <FileText className="h-4 w-4" />
      Add Text
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

`Play` is already imported; if not, add it to the lucide import.

- [ ] **Step 5: Branch card rendering on media type**

Replace the grid body (`videos.map((v) => { ... })` block) with a branch: when `v.media_type === 'text'`, render a text card; otherwise render the existing video card. The full replacement for the `videos.map(...)` callback:

```tsx
{videos.map((v) => {
  const videoId = extractVideoId(v.youtube_url ?? '')
  return v.media_type === 'text' ? (
    <Card
      key={v.id}
      className="group overflow-hidden border-border/50 hover:border-primary/30 transition-colors">
      <Link to={`/video/${v.id}`}>
        <div className="relative aspect-video bg-muted p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-primary/80" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
              Text
            </span>
          </div>
          <p className="text-xs leading-relaxed line-clamp-3 whitespace-pre-wrap text-muted-foreground/80">
            {v.content}
          </p>
        </div>
      </Link>
      <CardContent className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/video/${v.id}`}
            className="font-medium text-sm truncate block hover:text-primary transition-colors">
            {v.title}
          </Link>
          <Badge
            variant="outline"
            className={`mt-1.5 text-[10px] font-mono inline-flex items-center gap-1.5 ${getLangBadgeClasses(v.language)}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(v.language)}`} />
            {v.language}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
          onClick={(e) => {
            e.preventDefault()
            deleteVideo.mutate(v.id)
          }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  ) : (
    <Card
      key={v.id}
      className="group overflow-hidden border-border/50 hover:border-primary/30 transition-colors">
      <Link to={`/video/${v.id}`}>
        <div className="relative aspect-video bg-muted">
          {videoId && (
            <img
              src={getThumbnailUrl(videoId)}
              alt={v.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="h-10 w-10 text-white" />
          </div>
        </div>
      </Link>
      <CardContent className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/video/${v.id}`}
            className="font-medium text-sm truncate block hover:text-primary transition-colors">
            {v.title}
          </Link>
          <Badge
            variant="outline"
            className={`mt-1.5 text-[10px] font-mono inline-flex items-center gap-1.5 ${getLangBadgeClasses(v.language)}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(v.language)}`} />
            {v.language}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
          onClick={(e) => {
            e.preventDefault()
            deleteVideo.mutate(v.id)
          }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  )
})}
```

- [ ] **Step 6: Update the empty state copy**

Change `No videos yet. Add one above.` to `No media yet. Add one above.`

- [ ] **Step 7: Add the Add Text dialog**

After the existing Add Video `<Dialog>` (before `</Layout>`), add:

```tsx
<Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add Text</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          placeholder="e.g. Chapter 1 — The Journey"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Language</Label>
        <Select value={newLang} onValueChange={(v) => setNewLang(v)}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Text content</Label>
        <Textarea
          placeholder="Paste the full text here…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="min-h-[200px]"
        />
      </div>
    </div>
    <DialogFooter>
      <Button
        onClick={() => addText.mutate()}
        disabled={!newTitle.trim() || !newText.trim() || addText.isPending}
        className="text-sm font-semibold">
        {addText.isPending ? 'Saving…' : 'Add Text'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 8: Verify**

Run: `npx eslint src/pages/Index.tsx`
Expected: no errors.

Run: `npx tsc -b tsconfig.app.json`
Expected: no new errors beyond the pre-existing `videosDb.list` ones.

Manual smoke: run `npm run dev`, open Dashboard. The Add button opens a dropdown; Add Video shows the old dialog; Add Text shows title/language/textarea and saves; a text card appears with the preview.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "feat: add-text dropdown and text media cards on dashboard"
```

---

### Task 3: Study Room — text mode

**Files:**
- Modify: `src/pages/StudyRoom.tsx`
- Modify: `src/components/NoteEditor.tsx`
- Modify: `src/components/StudyRoomLists.tsx`

**Interfaces:**
- Consumes: `Video.media_type`/`content` from Task 1; `NoteEditor` props; `NoteList`/`ScreenshotList` props.
- Produces: `const isText = video.media_type === 'text'`; `NoteEditor` gains optional `showTimestamp?: boolean` (default `true`); `NoteList` and `ScreenshotList` gain optional `showTimestamp?: boolean` (default `true`). `NoteList`/`ScreenshotList` keep their `onSeek` props (passed a no-op in text mode).

- [ ] **Step 1: Add Copy import**

In `src/pages/StudyRoom.tsx`, add `Copy` to the lucide-react import.

- [ ] **Step 2: Derive isText and guard videoId**

After `const videoId = video ? extractVideoId(video.youtube_url) : null`, replace with:

```ts
const isText = video?.media_type === 'text'
const videoId = video && video.youtube_url ? extractVideoId(video.youtube_url) : null
```

- [ ] **Step 3: Disable playback keyboard shortcuts in text mode**

In the keyboard handler effect, after the Ctrl+Enter block and before `if (isInteractive) return`, insert:

```ts
if (isText) return
```

and add `isText` to the effect's dependency array (currently `[getCurrentPlayerTime, seekTo, openNotePanel]`).

- [ ] **Step 4: Timestamp-free note panel and screenshot uploads**

- In `openNotePanel`, change `setCurrentTime(getCurrentPlayerTime())` to `setCurrentTime(isText ? 0 : getCurrentPlayerTime())` and add `isText` to its `useCallback` deps.
- In `uploadScreenshot`'s `mutationFn`, change `const ts = getCurrentPlayerTime()` to `const ts = isText ? 0 : getCurrentPlayerTime()` and add `isText` to its deps (it's a `useMutation` with inline fn — `isText` is in scope; no deps array needed).

- [ ] **Step 5: Branch the media box**

Inside the container div (the one with the `outerWidth` style), replace the `<div className="rounded-xl border border-primary/20 ... aspect-video">...</div>` player block with:

```tsx
{isText ? (
  <div className="rounded-xl border border-primary/20 shadow-xl shadow-primary/5 overflow-hidden bg-card aspect-video flex flex-col">
    <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 shrink-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
        Text
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-xs"
        onClick={() => {
          navigator.clipboard.writeText(video.content ?? '')
          toast.success('Text copied')
        }}>
        <Copy className="h-3.5 w-3.5" />
        Copy text
      </Button>
    </div>
    <div className="flex-1 overflow-y-auto p-6">
      {video.content ? (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90 select-text">
          {video.content}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">This text item is empty.</p>
      )}
    </div>
  </div>
) : (
  <div className="rounded-xl border border-primary/20 shadow-xl shadow-primary/5 overflow-hidden bg-black aspect-video">
    <div className="w-full h-full relative">
      <div ref={playerContainerRef} className="w-full h-full" />

      {playerError !== null && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 text-white text-center p-6">
          <p className="font-semibold text-sm sm:text-base">
            This video can&apos;t play embedded (error {playerError}).
          </p>
          <p className="text-xs text-white/60 max-w-md">
            It may not allow embedding, or your browser is blocking YouTube. Open it
            directly instead.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="default"
              onClick={() => video.youtube_url && window.open(video.youtube_url, '_blank', 'noopener')}
              className="gap-2 text-xs">
              Watch on YouTube
            </Button>
            <Button
              variant="outline"
              onClick={() => setRetryToken((t) => t + 1)}
              className="gap-2 text-xs text-white border-white/30 hover:bg-white/10">
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 6: Hide VideoControls for text**

Wrap the `<VideoControls ... />` usage so it only renders for video:

```tsx
{!isText && (
  <VideoControls
    playerRef={playerRef}
    loopA={loopA}
    loopB={loopB}
    onSetA={() => setLoopA(getCurrentPlayerTime())}
    onSetB={() => setLoopB(getCurrentPlayerTime())}
    onClearLoop={() => {
      setLoopA(null)
      setLoopB(null)
    }}
  />
)}
```

- [ ] **Step 7: Pass showTimestamp and no-op seek**

- `NoteEditor` usage (both left and right panel instances): add props `showTimestamp={!isText}`.
- `NoteList` usage: `onSeek={isText ? () => {} : seekTo}` and `showTimestamp={!isText}`.
- `ScreenshotList` usage: `onSeek={isText ? () => {} : seekTo}` and `showTimestamp={!isText}`.

- [ ] **Step 8: NoteEditor header**

In `src/components/NoteEditor.tsx`:

- Add `showTimestamp?: boolean` to `NoteEditorProps`, default `true` (destructure `showTimestamp = true`).
- Replace the `<h2>` content:

```tsx
<h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
  <StickyNote className="h-4 w-4 text-primary" />
  Add Note{' '}
  {showTimestamp && (
    <span className="text-primary">at {formatTimestamp(timestamp)}</span>
  )}
</h2>
```

- [ ] **Step 9: NoteList / ScreenshotList badges**

In `src/components/StudyRoomLists.tsx`:

- `NoteListProps` and `ScreenshotListProps` gain `showTimestamp?: boolean`; destructure with default `true` in both memo components.
- In `NoteList`, wrap the timestamp `<Badge>` in `{showTimestamp && ( ... )}`.
- In `ScreenshotList`, wrap the timestamp `<Badge>` in `{showTimestamp && ( ... )}`.

- [ ] **Step 10: Verify**

Run: `npx eslint src/pages/StudyRoom.tsx src/components/NoteEditor.tsx src/components/StudyRoomLists.tsx`
Expected: no errors.

Run: `npx tsc -b tsconfig.app.json`
Expected: no new errors beyond the pre-existing ones.

Run: `npm run test`
Expected: all 32 existing tests pass.

Manual smoke: create a text item, open it — no player/controls, 16:9 box with scrollable text, Copy text works, pen overlay draws, note/vocab/lesson panels open, note editor shows no "at 0:00", notes and screenshots list without badges. Videos still play with all controls.

- [ ] **Step 11: Commit**

```bash
git add src/pages/StudyRoom.tsx src/components/NoteEditor.tsx src/components/StudyRoomLists.tsx
git commit -m "feat: text-mode study room with timestamp-free notes and screenshots"
```

---

### Task 4: Related touches — lessons media, badges, copy

**Files:**
- Modify: `src/components/LessonsPanel.tsx`
- Modify: `src/pages/LessonsPage.tsx`
- Modify: `src/pages/Languages.tsx`

**Interfaces:**
- Consumes: `Video.media_type` from Task 1.
- Produces: none (leaf changes).

- [ ] **Step 1: LessonsPanel media select**

In `src/components/LessonsPanel.tsx`:

- Add `FileText` to the lucide-react import.
- In the footer "Media context" `<Select>` options map, replace the item label:

```tsx
{videos.map((video) => (
  <SelectItem key={video.id} value={video.id}>
    <span className="inline-flex items-center gap-1.5">
      {video.media_type === 'text' ? (
        <FileText className="h-3 w-3" />
      ) : (
        <Video className="h-3 w-3" />
      )}
      {video.media_type === 'text' ? `Text: ${video.title}` : video.title}
    </span>
  </SelectItem>
))}
```

- [ ] **Step 2: LessonsPage media badges**

In `src/pages/LessonsPage.tsx`:

- Add `FileText` to the lucide-react import.
- Add a media-type lookup next to the existing `videoTitles` memo:

```ts
const mediaTypes = useMemo(() => {
  const map = new Map<string, string>()
  for (const v of videos) map.set(v.id, v.media_type)
  return map
}, [videos])
```

- In `LessonCard`, replace the media badge block (the `lesson.media_id ? (...)` conditional) with:

```tsx
{lesson.media_id ? (
  <Badge variant="outline" className="gap-1 text-[11px] font-mono text-primary/80">
    {mediaTypes.get(lesson.media_id) === 'text' ? (
      <>
        <FileText className="h-3 w-3" />
        {videoTitle ?? 'Text'}
      </>
    ) : (
      <>
        <Video className="h-3 w-3" />
        {videoTitle ?? 'Video'}
      </>
    )}
  </Badge>
) : (
  <Badge variant="outline" className="gap-1 text-[11px] font-mono text-muted-foreground/70">
    <BookOpen className="h-3 w-3" />
    No media
  </Badge>
)}
```

`LessonCard` needs `mediaTypes` passed in: add a `mediaTypes: Map<string, string>` prop to `LessonCardProps` and pass `mediaTypes={mediaTypes}` at the call site in `LessonsPage`.

- [ ] **Step 3: Languages copy**

In `src/pages/Languages.tsx`, change `Languages added here are available when adding new videos.` to `Languages added here are available when adding new media.`

- [ ] **Step 4: Verify**

Run: `npx eslint src/components/LessonsPanel.tsx src/pages/LessonsPage.tsx src/pages/Languages.tsx`
Expected: no errors.

Run: `npx tsc -b tsconfig.app.json`
Expected: no new errors beyond the pre-existing ones.

Run: `npm run test`
Expected: all 32 existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/LessonsPanel.tsx src/pages/LessonsPage.tsx src/pages/Languages.tsx
git commit -m "feat: text media in lesson media context and language copy"
```

---

### Task 5: Full verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm run test`
Expected: all tests pass.

Run: `npx eslint .`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 2: Manual end-to-end smoke**

1. Dashboard → Add → Add Text → paste text, title, language → card shows preview.
2. Open the text item → 16:9 box, scrollable, copy button works, no player/controls.
3. Add a note (Ctrl+Enter) → editor shows "Add Note" without timestamp → note lists without badge.
4. Upload a screenshot → listed without badge.
5. Pen overlay draws over the text; vocab and lesson-content panels work.
6. Add a video → old flow fully works (player, A-B loop, seek, timestamped notes/screenshots).
7. Lessons drawer: "Media context" lists text items as "Text: <title>"; lesson card badge shows the text icon/title.

- [ ] **Step 3: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "fix: verification fixes for text media"
```