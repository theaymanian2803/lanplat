import { Button } from '@/components/ui/button'
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import TableBlock from '@/components/TableBlock'
import TableBlockEditor from '@/components/TableBlockEditor'
import { lessonsDb } from '@/integrations/turso/db'
import type { ContentBlock, ContentBlockType, Part, TableData } from '@/integrations/turso/types'
import {
  BLOCK_TYPES,
  TEXT_COLORS,
  blockClass,
  blockStyle,
  createBlock,
  createTableBlock,
  isValidTable,
  parseBlocks,
  serializeBlocks,
} from '@/lib/lessonBlocks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Palette, Pencil, Plus, Trash2, Type } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface PartEditorProps {
  part: Part
}

interface ColorSwatchesProps {
  selected: string
  onSelect: (value: string) => void
}

const ColorSwatches = ({ selected, onSelect }: ColorSwatchesProps) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {TEXT_COLORS.map((c) => (
      <button
        key={c.value}
        type="button"
        title={c.label}
        onClick={() => onSelect(c.value)}
        className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
          selected === c.value ? 'ring-2 ring-primary/60 scale-110' : ''
        }`}
        style={{
          backgroundColor: c.value === 'inherit' ? 'var(--foreground)' : c.value,
          borderColor: selected === c.value ? 'hsl(var(--primary))' : 'hsl(var(--border))',
        }}
      />
    ))}
  </div>
)

const PartEditor = ({ part }: PartEditorProps) => {
  const queryClient = useQueryClient()
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => parseBlocks(part.content))
  const [text, setText] = useState('')
  const [blockType, setBlockType] = useState<ContentBlockType>('p')
  const [color, setColor] = useState('inherit')
  const [showPalette, setShowPalette] = useState(false)
  const [recolorBlockId, setRecolorBlockId] = useState<string | null>(null)
  const [tableHeaders, setTableHeaders] = useState<string[]>([])
  const [tableRows, setTableRows] = useState<string[][]>([])
  const [editTableBlockId, setEditTableBlockId] = useState<string | null>(null)
  const [editHeaders, setEditHeaders] = useState<string[]>([])
  const [editRows, setEditRows] = useState<string[][]>([])

  const saveBlocks = useMutation({
    mutationFn: async (next: ContentBlock[]) => {
      await lessonsDb.updatePart(part.id, serializeBlocks(next))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
    },
    onError: (e) => toast.error(e.message),
  })

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

  const removeBlock = (id: string) => {
    const next = blocks.filter((b) => b.id !== id)
    setBlocks(next)
    if (recolorBlockId === id) setRecolorBlockId(null)
    saveBlocks.mutate(next)
  }

  const applyColor = (id: string, nextColor: string) => {
    const next = blocks.map((b) => (b.id === id ? { ...b, color: nextColor } : b))
    setBlocks(next)
    saveBlocks.mutate(next)
  }

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={blockType} onValueChange={(v) => setBlockType(v as ContentBlockType)}>
            <SelectTrigger className="w-36 h-8 text-xs font-mono">
              <SelectValue placeholder="Block type" />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_TYPES.map((bt) => (
                <SelectItem key={bt.type} value={bt.type}>
                  {bt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {blockType !== 'table' && (
            <Button
              variant={showPalette ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 gap-2 text-xs"
              title="Text color"
              onClick={() => setShowPalette((v) => !v)}>
              <Palette className="h-3.5 w-3.5" />
              <span
                className="h-3 w-3 rounded-full border border-border inline-block"
                style={{ backgroundColor: color === 'inherit' ? 'var(--foreground)' : color }}
              />
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={addBlock}
            disabled={
              (blockType === 'table'
                ? !isValidTable(tableHeaders, tableRows)
                : !text.trim()) || saveBlocks.isPending
            }>
            <Plus className="h-3.5 w-3.5" />
            Add Block
          </Button>
        </div>

        {showPalette && (
          <div className="rounded-lg border border-border/40 bg-muted/30 p-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Text color — applies to next block
            </span>
            <ColorSwatches
              selected={color}
              onSelect={(v) => {
                setColor(v)
              }}
            />
          </div>
        )}

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
      </div>

      <div className="space-y-3">
        {blocks.length === 0 ? (
          <p className="text-xs text-muted-foreground/80 text-center py-8 border border-dashed border-border/50 rounded-xl">
            No content yet — add your first block above.
          </p>
        ) : (
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

              {recolorBlockId === block.id && block.type !== 'table' && (
                <div className="mt-1.5 rounded-lg border border-border/40 bg-muted/30 p-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Recolor this block
                  </span>
                  <ColorSwatches
                    selected={block.color}
                    onSelect={(v) => applyColor(block.id, v)}
                  />
                </div>
              )}

              <div className="absolute -top-2 -right-2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                {block.type !== 'table' && (
                  <Button
                    variant={recolorBlockId === block.id ? 'default' : 'secondary'}
                    size="icon"
                    className="h-6 w-6 shadow"
                    title="Recolor block"
                    onClick={() =>
                      setRecolorBlockId(recolorBlockId === block.id ? null : block.id)
                    }>
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
        )}
      </div>
    </div>
  )
}

export default PartEditor