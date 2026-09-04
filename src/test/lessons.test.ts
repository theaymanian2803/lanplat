import { describe, expect, it } from 'vitest'
import { appendBlockToContent, createBlock, parseBlocks, serializeBlocks } from '@/lib/lessonBlocks'
import { buildLessonTree } from '@/lib/lessonTree'
import type { Lesson, Part } from '@/integrations/turso/types'

const lesson = (id: string, title = id): Lesson => ({
  id,
  user_id: 'u',
  media_type: null,
  media_id: null,
  title,
  language: null,
  created_at: '2026-01-01T00:00:00.000Z',
})

const part = (id: string, lessonId: string, position = 1): Part => ({
  id,
  lesson_id: lessonId,
  user_id: 'u',
  position,
  content: '[]',
  created_at: '2026-01-01T00:00:00.000Z',
})

describe('lessonBlocks', () => {
  it('creates a block with default inherit color', () => {
    const block = createBlock('h1', 'Hello')
    expect(block.type).toBe('h1')
    expect(block.text).toBe('Hello')
    expect(block.color).toBe('inherit')
    expect(block.id).toBeTruthy()
  })

  it('round-trips blocks through serialize/parse', () => {
    const blocks = [
      createBlock('h1', 'Title', '#ef4444'),
      createBlock('p', 'Body', 'inherit'),
      createBlock('h3', 'Mini', '#3b82f6'),
    ]
    const parsed = parseBlocks(serializeBlocks(blocks))
    expect(parsed).toEqual(blocks)
  })

  it('returns [] for invalid JSON', () => {
    expect(parseBlocks('not json')).toEqual([])
  })

  it('filters out malformed blocks', () => {
    expect(parseBlocks('[{"id":1,"type":"h1","text":"x","color":"y"},{"nope":true}]')).toEqual([])
  })

  it('returns [] for non-array JSON', () => {
    expect(parseBlocks('{"a":1}')).toEqual([])
  })
})

describe('appendBlockToContent', () => {
  it('appends a block to existing content', () => {
    const blocks = [createBlock('h1', 'Verbs')]
    const content = serializeBlocks(blocks)
    const next = appendBlockToContent(content, createBlock('p', 'at spise — to eat'))

    expect(parseBlocks(next)).toEqual([
      expect.objectContaining({ type: 'h1', text: 'Verbs' }),
      expect.objectContaining({ type: 'p', text: 'at spise — to eat', color: 'inherit' }),
    ])
  })

  it('appends to empty content', () => {
    const next = appendBlockToContent('[]', createBlock('p', 'hund — dog'))
    expect(parseBlocks(next)).toEqual([
      expect.objectContaining({ type: 'p', text: 'hund — dog' }),
    ])
  })

  it('appends to invalid content by treating it as empty', () => {
    const next = appendBlockToContent('not json', createBlock('p', 'hund — dog'))
    expect(parseBlocks(next)).toEqual([
      expect.objectContaining({ type: 'p', text: 'hund — dog' }),
    ])
  })
})

describe('buildLessonTree', () => {
  it('nests parts under lessons in position order', () => {
    const l1 = lesson('l1')
    const p1 = part('p1', 'l1', 2)
    const p2 = part('p2', 'l1', 1)

    const tree = buildLessonTree([l1], [p1, p2])

    expect(tree).toHaveLength(1)
    expect(tree[0].parts.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('keeps lessons without parts and ignores orphan rows', () => {
    const l1 = lesson('l1')
    const l2 = lesson('l2')
    const tree = buildLessonTree([l1, l2], [part('p', 'ghost')])

    expect(tree).toHaveLength(2)
    expect(tree[0].parts).toEqual([])
    expect(tree[1].parts).toEqual([])
  })
})