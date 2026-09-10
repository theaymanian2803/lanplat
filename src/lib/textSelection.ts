export interface TextTap {
  time: number
  x: number
  y: number
}

export interface WordBounds {
  start: number
  end: number
}

const WORD_CHAR = /[\p{L}\p{N}'\u2019-]/u

export function getWordAtOffset(text: string, offset: number): WordBounds | null {
  if (!text) return null
  const clamped = Math.max(0, Math.min(offset, text.length))
  let start = clamped
  let end = clamped
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--
  while (end < text.length && WORD_CHAR.test(text[end])) end++
  if (start === end) return null
  return { start, end }
}

export function isDoubleTap(
  previous: TextTap | null,
  current: TextTap,
  maxDelayMs = 320,
  maxDistancePx = 32,
): boolean {
  if (!previous) return false
  return (
    current.time - previous.time <= maxDelayMs &&
    Math.abs(current.x - previous.x) <= maxDistancePx &&
    Math.abs(current.y - previous.y) <= maxDistancePx
  )
}

export function getFloatingButtonPosition(
  rect: { top: number; bottom: number; left: number; width: number },
  viewportWidth: number,
  buttonWidth = 128,
  buttonHeight = 36,
): { top: number; left: number } {
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - buttonWidth / 2, 8),
    Math.max(8, viewportWidth - buttonWidth - 8),
  )
  const top = rect.top - buttonHeight - 10 < 8 ? rect.bottom + 10 : rect.top - buttonHeight - 10
  return { top, left }
}

type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
}

export function getWordRangeAtPoint(
  container: HTMLElement,
  x: number,
  y: number,
): { range: Range; text: string } | null {
  const doc = container.ownerDocument as CaretDocument
  let node: Node | null = null
  let offset = 0

  if (typeof doc.caretRangeFromPoint === 'function') {
    const caret = doc.caretRangeFromPoint(x, y)
    if (caret) {
      node = caret.startContainer
      offset = caret.startOffset
    }
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const caret = doc.caretPositionFromPoint(x, y)
    if (caret) {
      node = caret.offsetNode
      offset = caret.offset
    }
  }

  if (!node || node.nodeType !== Node.TEXT_NODE || !container.contains(node)) return null

  const bounds = getWordAtOffset(node.textContent ?? '', offset)
  if (!bounds) return null

  const range = doc.createRange()
  range.setStart(node, bounds.start)
  range.setEnd(node, bounds.end)
  const text = range.toString().trim()
  if (!text) return null
  return { range, text }
}
