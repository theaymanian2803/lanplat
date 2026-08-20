import type { Lesson, Part, Sublesson } from '@/integrations/turso/types'
import { parseBlocks } from '@/lib/lessonBlocks'

export interface NestedLesson extends Lesson {
  sublessons: NestedSublesson[]
}

export interface NestedSublesson extends Sublesson {
  parts: Part[]
}

export function buildLessonTree(
  lessons: Lesson[],
  sublessons: Sublesson[],
  parts: Part[],
): NestedLesson[] {
  const partsBySublesson = new Map<string, Part[]>()
  for (const part of parts) {
    const list = partsBySublesson.get(part.sublesson_id) ?? []
    list.push(part)
    partsBySublesson.set(part.sublesson_id, list)
  }

  const sublessonsByLesson = new Map<string, NestedSublesson[]>()
  for (const sublesson of sublessons) {
    const nested: NestedSublesson = {
      ...sublesson,
      parts: (partsBySublesson.get(sublesson.id) ?? []).sort((a, b) => a.position - b.position),
    }
    const list = sublessonsByLesson.get(sublesson.lesson_id) ?? []
    list.push(nested)
    sublessonsByLesson.set(sublesson.lesson_id, list)
  }

  return lessons.map((lesson) => ({
    ...lesson,
    sublessons: (sublessonsByLesson.get(lesson.id) ?? []).sort(
      (a, b) => a.position - b.position,
    ),
  }))
}

export function partBlocks(part: Part) {
  return parseBlocks(part.content)
}