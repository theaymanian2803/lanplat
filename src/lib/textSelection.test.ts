import { afterEach, describe, expect, it } from 'vitest'
import {
  getFloatingButtonPosition,
  getLineStartButtonPosition,
  getWordAtOffset,
  getWordRangeAtPoint,
  isDoubleTap,
  mergeWordRanges,
} from '@/lib/textSelection'

describe('getWordAtOffset', () => {
  it('expands to the whole word around an offset inside it', () => {
    expect(getWordAtOffset('Hunden løber', 3)).toEqual({ start: 0, end: 6 })
  })

  it('finds the word when the offset sits at its end', () => {
    expect(getWordAtOffset('Hunden løber', 6)).toEqual({ start: 0, end: 6 })
    expect(getWordAtOffset('Hunden løber', 12)).toEqual({ start: 7, end: 12 })
  })

  it('ignores surrounding punctuation', () => {
    expect(getWordAtOffset('Hej, verden!', 1)).toEqual({ start: 0, end: 3 })
    expect(getWordAtOffset('Hej, verden!', 5)).toEqual({ start: 5, end: 11 })
  })

  it('keeps Danish letters, apostrophes and hyphens inside the word', () => {
    expect(getWordAtOffset('rødgrød med fløde', 3)).toEqual({ start: 0, end: 7 })
    expect(getWordAtOffset("l'école est finie", 4)).toEqual({ start: 0, end: 7 })
    expect(getWordAtOffset('well-known fact', 6)).toEqual({ start: 0, end: 10 })
  })

  it('returns null when the offset is on whitespace or the text is empty', () => {
    expect(getWordAtOffset('ab  cd', 3)).toBeNull()
    expect(getWordAtOffset('   ', 1)).toBeNull()
    expect(getWordAtOffset('', 0)).toBeNull()
  })

  it('clamps out-of-range offsets', () => {
    expect(getWordAtOffset('hund', 99)).toEqual({ start: 0, end: 4 })
    expect(getWordAtOffset('hund', -5)).toEqual({ start: 0, end: 4 })
  })
})

describe('isDoubleTap', () => {
  it('returns false without a previous tap', () => {
    expect(isDoubleTap(null, { time: 100, x: 10, y: 10 })).toBe(false)
  })

  it('returns true for two close taps in quick succession', () => {
    expect(isDoubleTap({ time: 100, x: 10, y: 10 }, { time: 300, x: 18, y: 14 })).toBe(true)
  })

  it('returns false when the taps are too slow', () => {
    expect(isDoubleTap({ time: 100, x: 10, y: 10 }, { time: 500, x: 10, y: 10 })).toBe(false)
  })

  it('returns false when the taps are too far apart', () => {
    expect(isDoubleTap({ time: 100, x: 10, y: 10 }, { time: 200, x: 80, y: 10 })).toBe(false)
  })
})

describe('getFloatingButtonPosition', () => {
  it('places the button above the rect', () => {
    expect(
      getFloatingButtonPosition({ top: 100, bottom: 120, left: 200, width: 60 }, 800),
    ).toEqual({ top: 54, left: 166 })
  })

  it('places the button below the rect when there is no room above', () => {
    expect(
      getFloatingButtonPosition({ top: 10, bottom: 30, left: 200, width: 60 }, 800),
    ).toEqual({ top: 40, left: 166 })
  })

  it('clamps the button inside the viewport', () => {
    expect(
      getFloatingButtonPosition({ top: 100, bottom: 120, left: 280, width: 60 }, 300).left,
    ).toBe(164)
    expect(
      getFloatingButtonPosition({ top: 100, bottom: 120, left: 0, width: 10 }, 300).left,
    ).toBe(8)
  })
})

describe('mergeWordRanges', () => {
  const setup = (text: string) => {
    const container = document.createElement('div')
    container.textContent = text
    document.body.appendChild(container)
    return container
  }

  const rangeFor = (node: Node, start: number, end: number) => {
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    return range
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('covers both words in document order', () => {
    const container = setup('Hunden løber hurtigt')
    const node = container.firstChild as Text
    const merged = mergeWordRanges(rangeFor(node, 0, 6), rangeFor(node, 7, 12))

    expect(merged.toString()).toBe('Hunden løber')
  })

  it('works when the second word comes before the anchor', () => {
    const container = setup('Hunden løber hurtigt')
    const node = container.firstChild as Text
    const merged = mergeWordRanges(rangeFor(node, 7, 12), rangeFor(node, 0, 6))

    expect(merged.toString()).toBe('Hunden løber')
  })

  it('merges words that live in different paragraphs', () => {
    const container = document.createElement('div')
    const first = document.createElement('p')
    first.textContent = 'Le fantôme'
    const second = document.createElement('p')
    second.textContent = 'existait ici'
    container.append(first, second)
    document.body.appendChild(container)

    const merged = mergeWordRanges(
      rangeFor(first.firstChild as Text, 0, 2),
      rangeFor(second.firstChild as Text, 0, 8),
    )

    expect(merged.toString()).toContain('Le fantôme')
    expect(merged.toString()).toContain('existait')
  })
})

describe('getLineStartButtonPosition', () => {
  const bounds = { top: 100, left: 50, width: 700, height: 400 }

  it('sits below the last line and aligns to the first line start', () => {
    const rects = [
      { top: 150, bottom: 170, left: 120 },
      { top: 180, bottom: 200, left: 90 },
    ]

    expect(getLineStartButtonPosition(rects, bounds)).toEqual({ top: 208, left: 120 })
  })

  it('moves above the first line when there is no room below', () => {
    const rects = [{ top: 460, bottom: 480, left: 120 }]

    expect(getLineStartButtonPosition(rects, bounds)).toEqual({ top: 416, left: 120 })
  })

  it('clamps the button inside the reader band', () => {
    const rects = [{ top: 150, bottom: 170, left: 5 }]

    expect(getLineStartButtonPosition(rects, bounds)).toEqual({ top: 178, left: 58 })
  })

  it('falls back to the top-left corner when there are no line rects', () => {
    expect(getLineStartButtonPosition([], bounds)).toEqual({ top: 108, left: 58 })
  })
})

describe('getWordRangeAtPoint', () => {
  const setup = (text: string) => {
    const container = document.createElement('div')
    container.textContent = text
    document.body.appendChild(container)
    return container
  }

  afterEach(() => {
    document.body.innerHTML = ''
    delete (document as unknown as Record<string, unknown>).caretRangeFromPoint
    delete (document as unknown as Record<string, unknown>).caretPositionFromPoint
  })

  const mockCaretRange = (node: Node, offset: number) => {
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => {
        const range = document.createRange()
        range.setStart(node, offset)
        range.collapse(true)
        return range
      },
    })
  }

  it('returns the word range under the point', () => {
    const container = setup('Hunden løber')
    const node = container.firstChild as Text
    mockCaretRange(node, 3)

    const result = getWordRangeAtPoint(container, 10, 10)

    expect(result?.text).toBe('Hunden')
    expect(result?.range.startOffset).toBe(0)
    expect(result?.range.endOffset).toBe(6)
  })

  it('falls back to caretPositionFromPoint when caretRangeFromPoint is unavailable', () => {
    const container = setup('Hunden løber')
    const node = container.firstChild as Text
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: () => ({ offsetNode: node, offset: 8 }),
    })

    expect(getWordRangeAtPoint(container, 10, 10)?.text).toBe('løber')
  })

  it('returns null when the point resolves outside the text container', () => {
    const container = setup('Hunden løber')
    const other = document.createElement('p')
    other.textContent = 'outside'
    document.body.appendChild(other)
    mockCaretRange(other.firstChild as Text, 2)

    expect(getWordRangeAtPoint(container, 10, 10)).toBeNull()
  })

  it('returns null when the point does not resolve to a text node', () => {
    const container = setup('Hunden løber')
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => null,
    })

    expect(getWordRangeAtPoint(container, 10, 10)).toBeNull()
  })
})
