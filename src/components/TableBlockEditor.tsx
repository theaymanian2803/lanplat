import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { parseTableFromJson, tableToJson } from '@/lib/lessonBlocks'
import { Check, ClipboardCopy, Import, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface TableBlockEditorProps {
  headers: string[]
  rows: string[][]
  onChange: (headers: string[], rows: string[][]) => void
}

const TableBlockEditor = ({ headers, rows, onChange }: TableBlockEditorProps) => {
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

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

  const runImport = () => {
    const result = parseTableFromJson(importText)
    if ('error' in result) {
      setImportError(result.error)
      return
    }
    onChange(result.headers, result.rows)
    setShowImport(false)
    setImportText('')
    setImportError('')
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(tableToJson(headers, rows))
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setImportError('Could not copy — your browser blocked clipboard access.')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 justify-end">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={copyJson}>
          {copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy as JSON'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => {
            setShowImport((v) => !v)
            setImportError('')
          }}>
          {showImport ? <X className="h-3 w-3" /> : <Import className="h-3 w-3" />}
          {showImport ? 'Close' : 'Import JSON'}
        </Button>
      </div>

      {showImport && (
        <div className="rounded-lg border border-border/40 bg-background p-2 space-y-2">
          <Textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value)
              setImportError('')
            }}
            placeholder='[{"Verb": "at spise", "Present": "spiser", "Past": "spiste"}, …]'
            className="min-h-24 font-mono text-xs"
          />
          {importError && <p className="text-xs text-destructive">{importError}</p>}
          <div className="flex gap-1.5 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setShowImport(false)
                setImportText('')
                setImportError('')
              }}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={runImport}
              disabled={!importText.trim()}>
              Import
            </Button>
          </div>
        </div>
      )}

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