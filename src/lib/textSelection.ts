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

const BLOCK_SELECTOR = 'p, div, li, h1, h2, h3, h4, h5, h6, blockquote, section, article'

function textNodesInRange(range: Range): Text[] {
  const root = range.commonAncestorContainer
  const walkRoot = root.nodeType === Node.TEXT_NODE ? root.parentNode : root
  if (!walkRoot) return []
  const walker = walkRoot.ownerDocument?.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT)
  if (!walker) return []
  const nodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    if (range.intersectsNode(node)) nodes.push(node as Text)
    node = walker.nextNode()
  }
  return nodes
}

/**
 * Range.toString() concatenates sibling block elements without separators, and the
 * reader renders every source line as its own <p>. Join text across block boundaries
 * with a space so a phrase spanning two lines does not become one glued word.
 */
export function getRangeText(range: Range): string {
  const nodes = textNodesInRange(range)
  if (nodes.length === 0) return ''
  let result = ''
  let previousBlock: Element | null = null
  for (const node of nodes) {
    const start = node === range.startContainer ? range.startOffset : 0
    const end = node === range.endContainer ? range.endOffset : node.length
    if (end <= start) continue
    const block = node.parentElement?.closest(BLOCK_SELECTOR) ?? null
    if (result && block !== previousBlock) result += ' '
    result += node.textContent?.slice(start, end) ?? ''
    previousBlock = block
  }
  return result.replace(/\s+/g, ' ').trim()
}

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

export interface LineRect {
  top: number
  bottom: number
  left: number
}

export interface Band {
  top: number
  left: number
  width: number
  height: number
}

export function mergeWordRanges(anchor: Range, other: Range): Range {
  const doc = anchor.startContainer.ownerDocument ?? other.startContainer.ownerDocument
  const merged = doc.createRange()
  const anchorFirst = anchor.compareBoundaryPoints(Range.START_TO_START, other) <= 0
  const start = anchorFirst ? anchor : other
  const end = anchorFirst ? other : anchor
  merged.setStart(start.startContainer, start.startOffset)
  merged.setEnd(end.endContainer, end.endOffset)
  return merged
}

export function getLineStartButtonPosition(
  rects: LineRect[],
  bounds: Band,
  size = { width: 128, height: 36 },
): { top: number; left: number } {
  const padding = 8
  const minLeft = bounds.left + padding
  const maxLeft = Math.max(minLeft, bounds.left + bounds.width - size.width - padding)
  if (rects.length === 0) return { top: bounds.top + padding, left: minLeft }

  const first = rects[0]
  const last = rects[rects.length - 1]
  const left = Math.min(Math.max(first.left, minLeft), maxLeft)
  const below = last.bottom + padding
  const above = first.top - size.height - padding
  const maxTop = Math.max(bounds.top + padding, bounds.top + bounds.height - size.height - padding)
  const top = below + size.height <= bounds.top + bounds.height - padding ? below : above

  return { top: Math.min(Math.max(top, bounds.top + padding), maxTop), left }
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
