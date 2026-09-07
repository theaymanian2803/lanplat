# Lesson Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `table` block type to lesson parts — verb conjugation tables with free-text tense headers (any language) and editable verb rows, creatable and editable in the Lessons library Part Editor, rendered as styled HTML tables in the read view.

**Architecture:** Extend the existing JSON block model (`part.content`) with an additive `table` field on `ContentBlock`. A controlled `TableBlockEditor` component handles column/row editing for both creation and in-place editing of existing tables; a shared `TableBlock` component renders tables in both the Part Editor preview and the read view (`LessonBlocks`).

**Tech Stack:** React 18 + TypeScript, TanStack Query, shadcn/ui primitives (Button, Input, Select, Label), Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-07-lesson-tables-design.md`

## Global Constraints

- No database schema changes — tables live in `part.content` JSON.
- `ContentBlock` changes are additive; existing blocks must parse unchanged.
- `text` is `''` for table blocks; `table` only set when `type === 'table'`.
- Editing scope is the Lessons library only; `AddLessonContentPanel.tsx` (Study Room quick-add) is untouched.
- Table blocks do not offer recolor; remove still works.
- Pre-existing lint/tsc errors (LessonsPanel.tsx, LessonsPage.tsx, StudyRoom.tsx, ui components, tailwind.config.ts) are out of scope — do not introduce NEW errors in files touched by this plan.
- Commands run from repo root: `npm run lint`, `npm run test`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run build`.

---

### Task 1: Data model + lib helpers

**Files:**
- Modify: `src/integrations/turso/types.ts:44-50` (ContentBlockType, ContentBlock)
- Modify: `src/lib/lessonBlocks.ts`
- Test: `src/test/lessons.test.ts`

**Interfaces:**
- Produces:
  - `type ContentBlockType = 'h1' | 'h2' | 'h3' | 'p' | 'table'`
  - `interface TableData { headers: string[]; rows: string[][] }`
  - `interface ContentBlock { id: string; type: ContentBlockType; text: string; color: string; table?: TableData }`
  - `createTableBlock(headers: string[], rows: string[][]): ContentBlock`
  - `isValidTable(headers: string[], rows: string[][]): boolean` — true iff ≥1 non-empty header AND ≥1 row with ≥1 non-empty cell
  - `parseBlocks(raw: string): ContentBlock[]` — now accepts + validates `table` blocks; sanitizes non-table blocks (drops stray `table` prop); filters malformed tables

- [ ] **Step 1: Write the failing tests** — append to `src/test/lessons.test.ts`:

```ts
describe('table blocks', () => {
  it('createTableBlock builds a table block with empty text', () => {
    const block = createTableBlock(['Infinitive', 'Present', 'Past'], [['at spise', 'spiser', 'spiste']])
    expect(block.type).toBe('table')
    expect(block.text).toBe('')
    expect(block.color).toBe('inherit')
    expect(block.table).toEqual({
      headers: ['Infinitive', 'Present', 'Past'],
      rows: [['at spise', 'spiser', 'spiste']],
    })
  })

  it('round-trips table blocks through serialize/parse', () => {
    const table = createTableBlock(['Infinitif', 'Présent', 'Passé'], [['être', 'suis', 'fus'], ['avoir', 'ai', 'eus']])
    expect(parseBlocks(serializeBlocks([table]))).toEqual([table])
  })

  it('filters table blocks with missing or malformed table data', () => {
    const bad = (o: object) => JSON.stringify([{ id: '1', type: 'table', text: '', color: 'inherit', ...o }])
    expect(parseBlocks(bad({}))).toEqual([])
    expect(parseBlocks(bad({ table: { headers: 'nope', rows: [] } }))).toEqual([])
    expect(parseBlocks(bad({ table: { headers: ['H'], rows: [[1]] } }))).toEqual([])
    expect(parseBlocks(bad({ table: { headers: ['H'], rows: ['x'] } }))).toEqual([])
  })

  it('keeps well-formed table blocks next to regular blocks', () => {
    const blocks = [
      createBlock('h1', 'Verbs'),
      createTableBlock(['Present', 'Future'], [['spiser', 'vil spise']]),
      createBlock('p', 'End of list'),
    ]
    expect(parseBlocks(serializeBlocks(blocks))).toEqual(blocks)
  })

  it('drops a stray table prop from non-table blocks', () => {
    const raw = JSON.stringify([
      { id: '1', type: 'p', text: 'hello', color: 'inherit', table: { headers: ['x'], rows: [] } },
    ])
    expect(parseBlocks(raw)).toEqual([{ id: '1', type: 'p', text: 'hello', color: 'inherit' }])
  })

  it('isValidTable requires a non-empty header and a row with a non-empty cell', () => {
    expect(isValidTable(['Present'], [['spiser']])).toBe(true)
    expect(isValidTable([' '], [['spiser']])).toBe(false)
    expect(isValidTable(['Present'], [['', '']])).toBe(false)
    expect(isValidTable(['Present'], [])).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `createTableBlock`, `isValidTable` not defined; `parseBlocks` drops table blocks.

- [ ] **Step 3: Implement** — `src/integrations/turso/types.ts`, replace lines 44-50:

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

`src/lib/lessonBlocks.ts`:

```ts
import type { ContentBlock, ContentBlockType, TableData } from '@/integrations/turso/types'

export const BLOCK_TYPES: { type: ContentBlockType; label: string }[] = [
  { type: 'h1', label: 'Heading 1' },
  { type: 'h2', label: 'Heading 2' },
  { type: 'h3', label: 'Heading 3' },
  { type: 'p', label: 'Paragraph' },
  { type: 'table', label: 'Table' },
]

export function createTableBlock(headers: string[], rows: string[][]): ContentBlock {
  return {
    id: crypto.randomUUID(),
    type: 'table',
    text: '',
    color: 'inherit',
    table: { headers, rows },
  }
}

export function isValidTable(headers: string[], rows: string[][]): boolean {
  if (!headers.some((h) => h.trim())) return false
  return rows.some((r) => r.some((c) => c.trim()))
}

function isTableData(t: unknown): t is TableData {
  if (!t || typeof t !== 'object') return false
  const td = t as TableData
  return (
    Array.isArray(td.headers) &&
    td.headers.every((h) => typeof h === 'string') &&
    Array.isArray(td.rows) &&
    td.rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string'))
  )
}

export function parseBlocks(raw: string): ContentBlock[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((b): ContentBlock[] => {
      if (!b || typeof b !== 'object') return []
      if (typeof b.id !== 'string' || typeof b.color !== 'string') return []
      const { id, type, text, color } = b
      if (type === 'h1' || type === 'h2' || type === 'h3' || type === 'p') {
        if (typeof text !== 'string') return []
        return [{ id, type, text, color }]
      }
      if (type === 'table') {
        if (typeof text !== 'string' || !isTableData(b.table)) return []
        return [{ id, type, text, color, table: b.table }]
      }
      return []
    })
  } catch {
    return []
  }
}
```

(Keep `blockClass`/`blockStyle`/`createBlock`/`serializeBlocks`/`appendBlockToContent` unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS — all suites green, including the 6 new table cases.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/turso/types.ts src/lib/lessonBlocks.ts src/test/lessons.test.ts
git commit -m "feat: table block data model and helpers"
```

---

### Task 2: TableBlockEditor component

**Files:**
- Create: `src/components/TableBlockEditor.tsx`
- Test: `src/components/TableBlockEditor.test.tsx`

**Interfaces:**
- Consumes: `TableData` shape from Task 1 (`headers: string[]`, `rows: string[][]`).
- Produces: `TableBlockEditor({ headers, rows, onChange }: { headers: string[]; rows: string[][]; onChange: (headers: string[], rows: string[][]) => void })` — controlled; every edit calls `onChange` with the next full state.

- [ ] **Step 1: Write the failing component test** — `src/components/TableBlockEditor.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TableBlockEditor from '@/components/TableBlockEditor'

const emptyEditor = () => {
  let state = { headers: [] as string[], rows: [] as string[][] }
  const view = render(
    <TableBlockEditor
      headers={state.headers}
      rows={state.rows}
      onChange={(h, r) => {
        state = { headers: h, rows: r }
      }}
    />
  )
  return { view, getState: () => state }
}

describe('TableBlockEditor', () => {
  it('adds a column and updates its header', () => {
    const { view, getState } = emptyEditor()
    fireEvent.click(screen.getByRole('button', { name: /add column/i }))
    const headerInput = view.container.querySelector('input')
    expect(headerInput).toBeTruthy()
    fireEvent.change(headerInput!, { target: { value: 'Present' } })
    expect(getState().headers).toEqual(['Present'])
  })

  it('adds a row with one input per column and edits cells', () => {
    const { view, getState } = emptyEditor()
    fireEvent.click(screen.getByRole('button', { name: /add column/i }))
    fireEvent.click(screen.getByRole('button', { name: /add row/i }))
    const inputs = view.container.querySelectorAll('input')
    fireEvent.change(inputs[1], { target: { value: 'spiser' } })
    expect(getState().rows).toEqual([['spiser']])
  })

  it('removes a column and its cells from every row', () => {
    let state = { headers: ['A', 'B'], rows: [['a', 'b']] }
    const { view } = render(
      <TableBlockEditor
        headers={state.headers}
        rows={state.rows}
        onChange={(h, r) => {
          state = { headers: h, rows: r }
        }}
      />
    )
    const removeButtons = view.container.querySelectorAll('button[title="Remove column"]')
    fireEvent.click(removeButtons[0])
    expect(state).toEqual({ headers: ['B'], rows: [['b']] })
  })

  it('removes a row', () => {
    let state = { headers: ['A'], rows: [['a'], ['b']] }
    const { view } = render(
      <TableBlockEditor
        headers={state.headers}
        rows={state.rows}
        onChange={(h, r) => {
          state = { headers: h, rows: r }
        }}
      />
    )
    const removeButtons = view.container.querySelectorAll('button[title="Remove row"]')
    fireEvent.click(removeButtons[0])
    expect(state.rows).toEqual([['b']])
  })
})
```

Note: remove buttons carry `title="Remove column"` / `title="Remove row"` in the implementation below — the selectors rely on them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/TableBlockEditor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/components/TableBlockEditor.tsx`:

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

interface TableBlockEditorProps {
  headers: string[]
  rows: string[][]
  onChange: (headers: string[], rows: string[][]) => void
}

const TableBlockEditor = ({ headers, rows, onChange }: TableBlockEditorProps) => {
  const updateHeader = (i: number, value: string) => {
    onChange(headers.map((h, idx) => (idx === i ? value : h)), rows)
  }

  const removeColumn = (i: number) => {
    onChange(
      headers.filter((_, idx) => idx !== i),
      rows.map((r) => r.filter((_, idx) => idx !== i))
    )
  }

  const addColumn = () => {
    onChange([...headers, ''], rows.map((r) => [...r, '']))
  }

  const updateCell = (ri: number, ci: number, value: string) => {
    onChange(
      headers,
      rows.map((r, idx) => (idx === ri ? r.map((c, j) => (j === ci ? value : c)) : r))
    )
  }

  const removeRow = (i: number) => {
    onChange(headers, rows.filter((_, idx) => idx !== i))
  }

  const addRow = () => {
    onChange(headers, [...rows, headers.map(() => '')])
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border/40 bg-muted/30 p-2 space-y-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
          Tense columns
        </span>
        {headers.length === 0 && (
          <p className="text-xs text-muted-foreground/80">Add at least one column…</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {headers.map((h, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={h}
                placeholder={`Column ${i + 1}`}
                onChange={(e) => updateHeader(i, e.target.value)}
                className="h-8 w-28 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                title="Remove column"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeColumn(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addColumn}>
            <Plus className="h-3.5 w-3.5" />
            Add column
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/30 p-2 space-y-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
          Verbs / rows
        </span>
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground/80">Add rows for each verb…</p>
        )}
        {rows.map((r, ri) => (
          <div key={ri} className="flex items-center gap-1.5">
            {r.map((c, ci) => (
              <Input
                key={ci}
                value={c}
                placeholder="…"
                onChange={(e) => updateCell(ri, ci, e.target.value)}
                className="h-8 flex-1 text-xs"
              />
            ))}
            <Button
              variant="ghost"
              size="icon"
              title="Remove row"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(ri)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" />
          Add row
        </Button>
      </div>
    </div>
  )
}

export default TableBlockEditor
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/TableBlockEditor.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TableBlockEditor.tsx src/components/TableBlockEditor.test.tsx
git commit -m "feat: table block editor component"
```

---

### Task 3: Table rendering (shared TableBlock + LessonBlocks)

**Files:**
- Create: `src/components/TableBlock.tsx`
- Modify: `src/components/LessonBlocks.tsx`
- Test: `src/components/LessonBlocks.test.tsx`

**Interfaces:**
- Consumes: `ContentBlock`/`TableData` from Task 1.
- Produces: `TableBlock({ table }: { table: TableData })` — renders `<table>`; returns `null` when `headers` or `rows` is empty. `LessonBlocks` renders `TableBlock` for `block.type === 'table'`.

- [ ] **Step 1: Write the failing test** — `src/components/LessonBlocks.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import LessonBlocks from '@/components/LessonBlocks'
import { createBlock, createTableBlock } from '@/lib/lessonBlocks'

describe('LessonBlocks', () => {
  it('renders a table block as an HTML table with headers and cells', () => {
    const table = createTableBlock(['Infinitiv', 'Præsens', 'Futur'], [['at spise', 'spiser', 'vil spise']])
    render(<LessonBlocks blocks={[table]} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Præsens' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'spiser' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'vil spise' })).toBeInTheDocument()
  })

  it('skips a table block without table data', () => {
    render(<LessonBlocks blocks={[{ id: '1', type: 'table', text: '', color: 'inherit' }]} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('still renders regular blocks', () => {
    render(<LessonBlocks blocks={[createBlock('h1', 'Verbs')]} />)
    expect(screen.getByRole('heading', { name: 'Verbs' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/LessonBlocks.test.tsx`
Expected: FAIL — `TableBlock` module not found; table blocks render nothing.

- [ ] **Step 3: Implement** — `src/components/TableBlock.tsx`:

```tsx
import type { TableData } from '@/integrations/turso/types'

interface TableBlockProps {
  table: TableData
}

const TableBlock = ({ table }: TableBlockProps) => {
  if (table.headers.length === 0 || table.rows.length === 0) return null
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden w-full">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th key={i} className="bg-muted/40 font-semibold text-left px-3 py-2 text-sm">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-sm border-t border-border/40">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TableBlock
```

`src/components/LessonBlocks.tsx` — replace the map body:

```tsx
import type { ContentBlock } from '@/integrations/turso/types'
import { blockClass, blockStyle } from '@/lib/lessonBlocks'
import { cn } from '@/lib/utils'
import TableBlock from '@/components/TableBlock'

const LessonBlocks = ({ blocks, className }: LessonBlocksProps) => (
  <div className={cn('space-y-3', className)}>
    {blocks.map((block) => {
      if (block.type === 'table') {
        if (!block.table) return null
        return <TableBlock key={block.id} table={block.table} />
      }
      const Tag = block.type as keyof JSX.IntrinsicElements
      return (
        <Tag key={block.id} className={blockClass(block.type)} style={blockStyle(block.color)}>
          {block.text}
        </Tag>
      )
    })}
  </div>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/LessonBlocks.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TableBlock.tsx src/components/LessonBlocks.tsx src/components/LessonBlocks.test.tsx
git commit -m "feat: render table blocks in lesson content"
```

---

### Task 4: PartEditor integration (create + edit)

**Files:**
- Modify: `src/components/PartEditor.tsx`

**Interfaces:**
- Consumes: `BLOCK_TYPES` (now includes `table`), `createTableBlock`, `isValidTable` from Task 1; `TableBlockEditor` from Task 2; `TableBlock` from Task 3.
- Produces: Part Editor gains "Table" in the block-type select (builder replaces the textarea), and Pencil edit mode on existing table blocks (builder + Save/Cancel replace the block in place).

- [ ] **Step 1: Write the implementation** — `src/components/PartEditor.tsx` full changes:

Imports — add to the existing lucide import line (`Palette, Plus, Trash2, Type`) a `Pencil` icon, and add imports:

```tsx
import TableBlock from '@/components/TableBlock'
import TableBlockEditor from '@/components/TableBlockEditor'
import { createTableBlock, isValidTable } from '@/lib/lessonBlocks'
```

State — add after the existing `recolorBlockId` state:

```tsx
const [tableHeaders, setTableHeaders] = useState<string[]>([])
const [tableRows, setTableRows] = useState<string[][]>([])
const [editTableBlockId, setEditTableBlockId] = useState<string | null>(null)
const [editHeaders, setEditHeaders] = useState<string[]>([])
const [editRows, setEditRows] = useState<string[][]>([])
```

`addBlock` — branch before the existing guard:

```tsx
const addBlock = () => {
  if (blockType === 'table') {
    const cleanRows = tableRows.filter((r) => r.some((c) => c.trim()))
    if (!isValidTable(tableHeaders, cleanRows)) return
    const next = [...blocks, createTableBlock(tableHeaders, cleanRows)]
    setBlocks(next)
    setTableHeaders([])
    setTableRows([])
    setShowPalette(false)
    saveBlocks.mutate(next)
    return
  }
  if (!text.trim()) return
  const next = [...blocks, createBlock(blockType, text, color)]
  setBlocks(next)
  setText('')
  setShowPalette(false)
  saveBlocks.mutate(next)
}
```

Edit-mode handlers — add after `applyColor`:

```tsx
const openTableEdit = (id: string, table: TableData) => {
  setEditTableBlockId(id)
  setEditHeaders(table.headers)
  setEditRows(table.rows)
}

const saveTableEdit = () => {
  if (!editTableBlockId) return
  const cleanRows = editRows.filter((r) => r.some((c) => c.trim()))
  if (!isValidTable(editHeaders, cleanRows)) return
  const next = blocks.map((b) =>
    b.id === editTableBlockId
      ? { ...b, table: { headers: editHeaders, rows: cleanRows } }
      : b
  )
  setBlocks(next)
  setEditTableBlockId(null)
  saveBlocks.mutate(next)
}
```

(Add `import type { TableData } from '@/integrations/turso/types'` — extend the existing type import line.)

Block-type select — the options come from `BLOCK_TYPES` (already includes Table via Task 1); no JSX change needed there.

Palette button — hide when table type selected: wrap the existing palette `<Button>` in `{blockType !== 'table' && ( ... )}`.

Add Block button — replace `disabled={!text.trim() || saveBlocks.isPending}` with:

```tsx
disabled={
  (blockType === 'table'
    ? !isValidTable(tableHeaders, tableRows)
    : !text.trim()) || saveBlocks.isPending
}
```

Textarea row — replace the `<div className="flex items-center gap-2">` (the `Type` icon + textarea block, lines 145-159) with:

```tsx
{blockType === 'table' ? (
  <TableBlockEditor
    headers={tableHeaders}
    rows={tableRows}
    onChange={(h, r) => {
      setTableHeaders(h)
      setTableRows(r)
    }}
  />
) : (
  <div className="flex items-center gap-2">
    <Type className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    <AutoGrowTextarea
      placeholder="Type block content…"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
          e.preventDefault()
          addBlock()
        }
      }}
      className="bg-muted/30 text-sm"
    />
  </div>
)}
```

Block list — replace the block rendering div (lines ~168-209) so table blocks render a preview + Pencil, recolor is hidden for tables, and the edit builder renders inline:

```tsx
blocks.map((block) => (
  <div key={block.id} className="group relative">
    {block.type === 'table' && block.table ? (
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <TableBlock table={block.table} />
      </div>
    ) : (
      <div
        className={`${blockClass(block.type)} rounded-lg px-3 py-2 bg-muted/20 border border-border/30`}
        style={blockStyle(block.color)}>
        {block.text}
      </div>
    )}

    {editTableBlockId === block.id && (
      <div className="mt-1.5 space-y-1.5 rounded-lg border border-border/40 bg-muted/30 p-2">
        <TableBlockEditor
          headers={editHeaders}
          rows={editRows}
          onChange={(h, r) => {
            setEditHeaders(h)
            setEditRows(r)
          }}
        />
        <div className="flex gap-1.5 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setEditTableBlockId(null)}>
            Cancel
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={saveTableEdit}>
            Save
          </Button>
        </div>
      </div>
    )}

    <div className="absolute -top-2 -right-2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
      {block.type !== 'table' && (
        <Button
          variant={recolorBlockId === block.id ? 'default' : 'secondary'}
          size="icon"
          className="h-6 w-6 shadow"
          title="Recolor block"
          onClick={() => setRecolorBlockId(recolorBlockId === block.id ? null : block.id)}>
          <Palette className="h-3 w-3" />
        </Button>
      )}
      {block.type === 'table' && block.table && (
        <Button
          variant={editTableBlockId === block.id ? 'default' : 'secondary'}
          size="icon"
          className="h-6 w-6 shadow"
          title="Edit table"
          onClick={() => openTableEdit(block.id, block.table)}>
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      <Button
        variant="destructive"
        size="icon"
        className="h-6 w-6 shadow"
        title="Remove block"
        onClick={() => removeBlock(block.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  </div>
))
```

Note: do NOT render `{block.type === 'table' && recolorBlockId === block.id && setRecolorBlockId(null)}` — instead, when `removeBlock`/recolor state logic runs, guard the recolor panel below (`recolorBlockId === block.id && block.type !== 'table'`). Use that guard on the existing recolor panel div.

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit; npm run lint`
Expected: no errors in `src/components/PartEditor.tsx` or other files touched by this plan (pre-existing errors elsewhere are acceptable).

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev` — open the app → Lessons library → open a lesson → select a part → in Part Editor, choose "Table" in the block-type select; add columns ("Infinitive", "Present", "Past", "Future") and rows with verb forms; "Add Block" saves it to the part. Click the Pencil on the table block, add another row, Save — the preview updates. Recolor button absent for tables; remove still works.

- [ ] **Step 4: Commit**

```bash
git add src/components/PartEditor.tsx
git commit -m "feat: create and edit table blocks in part editor"
```

---

### Task 5: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all suites pass (existing 39 tests + new table tests + component tests).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no NEW errors vs the pre-change baseline (pre-existing errors in ui components, StudyRoom.tsx, LessonsPanel.tsx, LessonsPage.tsx, tailwind.config.ts are out of scope).

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors in files touched by this plan (`types.ts`, `lessonBlocks.ts`, `LessonBlocks.tsx`, `PartEditor.tsx`, `TableBlock.tsx`, `TableBlockEditor.tsx`, tests).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit any stragglers**

```bash
git status --short
git add -A && git commit -m "chore: final verification"
```
(Only commit if there are uncommitted changes.)