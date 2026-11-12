import type { Lesson, Part } from '@/integrations/turso/types'
import { parseBlocks } from '@/lib/lessonBlocks'

export interface NestedLesson extends Lesson {
  parts: Part[]
}

export function buildLessonTree(lessons: Lesson[], parts: Part[]): NestedLesson[] {
  const partsByLesson = new Map<string, Part[]>()
  for (const part of parts) {
    const list = partsByLesson.get(part.lesson_id) ?? []
    list.push(part)
    partsByLesson.set(part.lesson_id, list)
  }

  return lessons.map((lesson) => ({
    ...lesson,
    parts: (partsByLesson.get(lesson.id) ?? []).sort((a, b) => a.position - b.position),
  }))
}

export function partBlocks(part: Part) {
  return parseBlocks(part.content)
}

/** One-line preview for the compact parts list. */
export function partSnippet(part: Part): string {
  const blocks = parseBlocks(part.content)
  const text = blocks.find((block) => block.type !== 'table' && block.text.trim())
  if (text) return text.text.replace(/\s+/g, ' ').trim()
  const headers = blocks.find((block) => block.type === 'table' && block.table)?.table?.headers
  if (headers?.length) return headers.filter(Boolean).join(' · ')
  return 'Empty part'
}