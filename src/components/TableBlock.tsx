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