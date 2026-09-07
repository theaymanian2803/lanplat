# Lesson Tables: Verb Conjugation Tables in Lesson Parts

Date: 2026-09-07

## Context

Lesson parts currently hold a flat list of text blocks (`h1`, `h2`, `h3`, `p`), each
`{ id, type, text, color }`, serialized as JSON into `part.content`. Blocks are edited in
the Lessons library drawer (`PartEditor`) and rendered by `LessonBlocks`.

Users want verb conjugation tables inside lessons: a header row of tense columns
(Infinitive, Present, Past, Future — free text so headers can be written in any language,
e.g. French or Swedish), with rows of verbs and their forms. Tables must remain editable
after creation so new verbs can be appended as rows later.

## Decisions (approved)

1. **New `table` block type** with structured data — no reuse of the `text` field for JSON.
2. **No database schema change** — tables live inside the existing `part.content` JSON.
3. **Editing scope: Lessons library only** — the Study Room quick-add panel is unchanged.
4. **Fully editable** — existing table blocks can be reopened, renamed, and extended.

## 1. Data model

`src/integrations/turso/types.ts`:

```ts
export type ContentBlockType = 'h1' | 'h2' | 'h3' | 'p' | 'table'

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface ContentBlock {
  id: string
  type: ContentBlockType
  text: string
  color: string
  table?: TableData
}
```

- `text` is `''` for table blocks; `table` is only set for `type === 'table'`.
- Existing blocks are unaffected (additive change).

`src/lib/lessonBlocks.ts`:

- `BLOCK_TYPES` gains `{ type: 'table', label: 'Table' }`.
- New `createTableBlock(headers: string[], rows: string[][]): ContentBlock` — `id` via
  `crypto.randomUUID()`, `type: 'table'`, `text: ''`, `color: 'inherit'`.
- `parseBlocks` validation: `type` check becomes a five-way union; for `table` blocks,
  require `Array.isArray(table?.headers) && Array.isArray(table?.rows)` where every
  element of both is a string; drop `table` from non-table blocks (spread without it);
  require `typeof b.table === 'object'` for table blocks. Malformed table blocks are
  filtered out like other malformed blocks.

## 2. Editor (Lessons library — `PartEditor.tsx`)

- When the block-type select is `table`, the content textarea row is replaced by a table
  builder component (new file `src/components/TableBlockEditor.tsx`):
  - **Columns**: a header input per column (placeholder "e.g. Present"), an × button to
    remove the column, and an "Add column" button. Removing a column also removes the
    matching cell from every row.
  - **Rows**: one input row per verb, one cell input per column, an × to remove the row,
    and an "Add row" button. Cell inputs are plain text inputs (keep it simple; no
    autogrow needed inside tables).
  - **State**: local `headers: string[]`, `rows: string[][]`. Normalize on edit: trimming
    is NOT done on save (users may want spaces); empty cells are allowed; a row whose
    cells are all empty is dropped on save.
  - **Enable rule**: "Add Block" requires ≥1 non-empty header and ≥1 row with at least one
    non-empty cell.
- `TableBlockEditor` props: `headers`, `rows`, `onChange(headers, rows)` — controlled, so
  the same component serves both creation and editing.
- **Editing existing tables**: each table block in the block list renders its table
  preview plus a Pencil button (added next to the existing recolor/remove buttons).
  Clicking Pencil enters edit mode for that block: the builder appears (prefilled from
  `block.table`) with Save / Cancel. Save replaces the block in place
  (`blocks.map`), Cancel discards. Recolor is not offered for table blocks; remove still
  works. Edit mode is exclusive: opening edit for one block closes it for others.
- `PartEditor` gains `editTableBlockId: string | null` state; `addBlock` branches: for
  `table` type, build from builder state via `createTableBlock`; the builder replaces the
  textarea UI only when `blockType === 'table'` (and no block is being edited).
- No changes to `AddLessonContentPanel.tsx` (Study Room quick-add stays text-only).

## 3. Rendering (`src/components/LessonBlocks.tsx`)

- `type === 'table'` renders a styled HTML table instead of a Tag:

```tsx
<table className="w-full text-sm border-collapse">
  <thead>
    <tr>{headers.map(h => <th key={i} className="...">{h}</th>)}</tr>
  </thead>
  <tbody>
    {rows.map((r, i) => (
      <tr key={i}>{r.map((c, j) => <td key={j} className="...">{c}</td>)}</tr>
    ))}
  </tbody>
</table>
```

- Styling: `rounded-lg border border-border/50 overflow-hidden`, header cells
  `bg-muted/40 font-semibold text-left px-3 py-2 text-sm`, body cells
  `px-3 py-2 text-sm border-t border-border/40`, `text` color inherited (no `color`
  application for tables). Empty table (no headers/rows) renders nothing.
- All other block types render exactly as today (Tag + `blockClass` + `blockStyle`).

## 4. Testing

- Extend `src/test/lessons.test.ts`:
  - `createTableBlock` produces a valid `table` block with empty `text`.
  - Table blocks round-trip through `serializeBlocks`/`parseBlocks`.
  - `parseBlocks` filters malformed tables (missing `table`, non-array `headers`/`rows`,
    wrong element types, `table` on a non-table block) and keeps well-formed ones.
  - Mixed content (headings + paragraphs + tables) round-trips.
- Existing tests stay green; `npm run lint` and `npx tsc -p tsconfig.app.json --noEmit`
  must introduce no new errors (pre-existing errors in `LessonsPanel.tsx`,
  `LessonsPage.tsx`, `StudyRoom.tsx`, etc. are out of scope).

## Out of scope

- Tables in the Study Room quick-add panel.
- Column/cell styling controls (colors, alignment) inside tables.
- Row reordering, column reordering.
- Copy/paste from spreadsheet apps.
- Deleting/editing tables from the read view (`LessonsPage` display is read-only today).