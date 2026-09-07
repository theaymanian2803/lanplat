import type { CSSProperties } from 'react'
import type { ContentBlock, ContentBlockType, TableData } from '@/integrations/turso/types'

export const TEXT_COLORS = [
  { label: 'Default', value: 'inherit' },
  { label: 'Slate', value: '#64748b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#eab308' },
  { label: 'Lime', value: '#84cc16' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Rose', value: '#f43f5e' },
]

export const BLOCK_TYPES: { type: ContentBlockType; label: string }[] = [
  { type: 'h1', label: 'Heading 1' },
  { type: 'h2', label: 'Heading 2' },
  { type: 'h3', label: 'Heading 3' },
  { type: 'p', label: 'Paragraph' },
  { type: 'table', label: 'Table' },
]

export function blockClass(type: ContentBlockType): string {
  switch (type) {
    case 'h1':
      return 'text-2xl font-bold tracking-tight'
    case 'h2':
      return 'text-xl font-semibold tracking-tight'
    case 'h3':
      return 'text-lg font-semibold'
    default:
      return 'text-sm leading-relaxed'
  }
}

export function blockStyle(color: string): CSSProperties | undefined {
  return color === 'inherit' ? undefined : { color }
}

export function createBlock(
  type: ContentBlockType,
  text: string,
  color = 'inherit',
): ContentBlock {
  return { id: crypto.randomUUID(), type, text, color }
}

export function serializeBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks)
}

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

export function appendBlockToContent(content: string, block: ContentBlock): string {
  return serializeBlocks([...parseBlocks(content), block])
}