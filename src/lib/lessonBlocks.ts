import type { CSSProperties } from 'react'
import type { ContentBlock, ContentBlockType } from '@/integrations/turso/types'

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

export function parseBlocks(raw: string): ContentBlock[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (b): b is ContentBlock =>
        b &&
        typeof b === 'object' &&
        typeof b.id === 'string' &&
        (b.type === 'h1' || b.type === 'h2' || b.type === 'h3' || b.type === 'p') &&
        typeof b.text === 'string' &&
        typeof b.color === 'string',
    )
  } catch {
    return []
  }
}