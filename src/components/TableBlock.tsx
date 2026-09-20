import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TableData } from '@/integrations/turso/types'
import { Maximize2 } from 'lucide-react'
import { useState } from 'react'

interface TableBlockProps {
  table: TableData
  previewRows?: number
}

const renderTable = (table: TableData, textClass: string, previewRows?: number) => {
  const rows = previewRows ? table.rows.slice(0, previewRows) : table.rows
  return (
    <table className={`w-full ${textClass} border-collapse`}>
      <thead>
        <tr>
          {table.headers.map((h, i) => (
            <th key={i} className="bg-muted/40 font-semibold text-left px-3 py-2">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="px-3 py-2 border-t border-border/40">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const TableBlock = ({ table, previewRows }: TableBlockProps) => {
  const [open, setOpen] = useState(false)
  if (table.headers.length === 0 || table.rows.length === 0) return null
  return (
    <div className="group relative rounded-lg border border-border/50 overflow-hidden w-full">
      <Button
        variant="ghost"
        size="icon"
        title="Expand table"
        className="absolute top-1 right-1 z-10 h-6 w-6 shadow-sm bg-background/70 hover:bg-background opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}>
        <Maximize2 className="h-3 w-3" />
      </Button>
      <div className="w-full overflow-x-auto">
        {renderTable(table, 'text-sm', previewRows)}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Table</DialogTitle>
            <DialogDescription className="sr-only">
              Expanded view of the conjugation table.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border/50">
            {renderTable(table, 'text-base')}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TableBlock