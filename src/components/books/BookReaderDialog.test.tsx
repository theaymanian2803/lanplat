import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import BookReaderDialog from '@/components/books/BookReaderDialog'
import AiTutorDock from '@/components/ai/AiTutorDock'
import { resetAiTutor } from '@/lib/aiTutor'
import type { Book } from '@/lib/bookCatalog'

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn().mockResolvedValue([]) },
  vocabularyDb: { insert: vi.fn().mockResolvedValue(undefined) },
}))

const book: Book = {
  id: 62215,
  title: 'Le Fantôme de l’Opéra',
  authors: [{ name: 'Leroux, Gaston', birth_year: 1868, death_year: 1927 }],
  formats: {
    'text/plain; charset=utf-8': 'https://www.gutenberg.org/cache/epub/62215/pg62215.txt',
  },
  languages: ['fr'],
}

const SAMPLE_TEXT =
  'The Project Gutenberg eBook header\n*** START OF THE PROJECT GUTENBERG EBOOK LE FANTÔME DE L’OPÉRA ***\n\nCHAPITRE PREMIER\n\nLe fantôme existait.\n\n*** END OF THE PROJECT GUTENBERG EBOOK LE FANTÔME DE L’OPÉRA ***'

const MULTI_CHAPTER_TEXT =
  '*** START OF THE PROJECT GUTENBERG EBOOK ***\n\nCHAPITRE PREMIER\n\nLe fantôme existait.\n\nCHAPITRE II\n\nOn ne le croyait pas.\n\n*** END OF THE PROJECT GUTENBERG EBOOK ***'

const WRAPPED_TEXT =
  '*** START OF THE PROJECT GUTENBERG EBOOK ***\n\nLe fantôme\n\nexistait ici.\n\n*** END OF THE PROJECT GUTENBERG EBOOK ***'

function stubFetch(value: unknown) {
  const fn = vi.fn().mockResolvedValue(value)
  vi.stubGlobal('fetch', fn)
  return fn
}

const stubRect = (el: Element, overrides: Partial<DOMRect>) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect)

const stubSelection = (
  node: Node,
  text: string,
  rect = { top: 120, bottom: 140, left: 20, width: 90, height: 20 },
  readerRect = { top: 100, bottom: 700, left: 0, right: 800, width: 800, height: 600 }
) => {
  const reader = (node as HTMLElement).closest('.reader-scroll')
  if (reader) stubRect(reader, readerRect)
  const removeAllRanges = vi.fn()
  window.getSelection = vi.fn().mockReturnValue({
    isCollapsed: false,
    anchorNode: node,
    focusNode: node,
    toString: () => text,
    getRangeAt: () => ({ getBoundingClientRect: () => rect }),
    removeAllRanges,
  } as unknown as Selection)
  return removeAllRanges
}

const makeCoarsePointer = () => {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: query.includes('pointer: coarse'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

const stubCaretAt = (node: Node, offsets: number[]) => {
  let call = 0
  Object.defineProperty(document, 'caretRangeFromPoint', {
    configurable: true,
    value: () => {
      const range = document.createRange()
      range.setStart(node, offsets[Math.min(call++, offsets.length - 1)])
      range.collapse(true)
      return range
    },
  })
}

const stubCaretSequence = (items: Array<{ node: Node; offset: number }>) => {
  let call = 0
  Object.defineProperty(document, 'caretRangeFromPoint', {
    configurable: true,
    value: () => {
      const item = items[Math.min(call++, items.length - 1)]
      const range = document.createRange()
      range.setStart(item.node, item.offset)
      range.collapse(true)
      return range
    },
  })
}

const stubLineRects = (
  rects: Array<{ top: number; bottom: number; left: number; width: number; height: number }>
) => {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => rects,
  })
}

const tap = (target: Element, x = 150, y = 310) => {
  const point = { clientX: x, clientY: y, identifier: 1 }
  fireEvent.touchStart(target, { touches: [point], changedTouches: [point] })
  fireEvent.touchEnd(target, { touches: [point], changedTouches: [point] })
}

const renderDialog = (
  overrides: Partial<Book> = {},
  onClose = vi.fn(),
  language = 'French'
) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <BookReaderDialog book={{ ...book, ...overrides }} language={language} onClose={onClose} />
    </QueryClientProvider>
  )
}

describe('BookReaderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAiTutor()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (document as unknown as Record<string, unknown>).caretRangeFromPoint
    delete (Range.prototype as unknown as Record<string, unknown>).getClientRects
  })

  it('fetches the book text through the proxy and renders the body', async () => {
    const fn = stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
    expect(fn.mock.calls[0][0]).toBe('/gutenberg/cache/epub/62215/pg62215.txt')
    expect(screen.getByText('Le Fantôme de l’Opéra')).toBeInTheDocument()
    expect(screen.getByText('Gaston Leroux')).toBeInTheDocument()
  })

  it('opens at the first titled section instead of the production front matter', async () => {
    stubFetch({
      ok: true,
      text: async () =>
        '*** START OF THE PROJECT GUTENBERG EBOOK ***\n\nProduced by a volunteer.\n\nCHAPITRE PREMIER\n\nLe fantôme existait.\n\n*** END OF THE PROJECT GUTENBERG EBOOK ***',
    })
    renderDialog()

    expect(await screen.findByText('CHAPITRE PREMIER')).toBeInTheDocument()
    expect(screen.queryByText('Produced by a volunteer.')).toBeNull()
  })

  it('renders chapter headings with emphasis', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const heading = await screen.findByText('CHAPITRE PREMIER')
    expect(heading.tagName).toBe('H2')
    expect(heading.className).toContain('font-display')
  })

  it('shows an error with a retry when the fetch fails', async () => {
    stubFetch({ ok: false, status: 404 })
    renderDialog()

    expect(await screen.findByRole('alert')).toHaveTextContent(/Book text request failed/)

    const fn = stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
    expect(fn).toHaveBeenCalled()
  })

  it('explains when the book has no readable text', async () => {
    stubFetch({ ok: true, text: async () => '' })
    renderDialog({ formats: {} })

    expect(
      await screen.findByText('No readable text is available for this book.')
    ).toBeInTheDocument()
  })

  it('shows Add to vocab for a selection and opens the form when it is pressed', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    const removeAllRanges = stubSelection(paragraph, 'fantôme')
    fireEvent.mouseUp(paragraph)

    const pill = await screen.findByRole('button', { name: 'Add to vocab' })
    expect(screen.queryByPlaceholderText('e.g. hund')).toBeNull()
    fireEvent.click(pill)

    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme')
    )
    expect(removeAllRanges).toHaveBeenCalled()
  })

  it('captures a whole phrase, not a single word', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'Le   fantôme existait.')
    fireEvent.mouseUp(paragraph)

    fireEvent.click(await screen.findByRole('button', { name: 'Add to vocab' }))

    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('le fantôme existait.')
    )
  })

  it('pre-fills the vocab form with the language of the book being read', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog({}, vi.fn(), 'Spanish')

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'fantôme')
    fireEvent.mouseUp(paragraph)
    fireEvent.click(await screen.findByRole('button', { name: 'Add to vocab' }))

    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveTextContent('Spanish')
    )
  })

  it('shows the pill from a touch-style selectionchange without mouseup', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'fantôme')
    fireEvent(document, new Event('selectionchange'))

    const pill = await screen.findByRole('button', { name: 'Add to vocab' })
    fireEvent.click(pill)

    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme')
    )
  })

  it('selects a word on a tap without a native selection and shows the capture bar', async () => {
    const restore = makeCoarsePointer()
    try {
      stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
      renderDialog()

      const paragraph = await screen.findByText('Le fantôme existait.')
      stubCaretAt(paragraph.firstChild as Node, [3])
      stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])
      stubRect(screen.getByRole('dialog'), {
        top: 100,
        left: 50,
        bottom: 700,
        right: 850,
        width: 800,
        height: 600,
      })
      stubRect(paragraph.closest('.reader-scroll') as Element, {
        top: 150,
        left: 60,
        bottom: 650,
        right: 760,
        width: 700,
        height: 500,
      })

      tap(paragraph)

      const bar = await screen.findByTestId('reader-touch-bar')
      const pill = within(bar).getByRole('button', { name: 'Add to vocab' })
      fireEvent.click(pill)

      await waitFor(() =>
        expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme')
      )
    } finally {
      restore()
    }
  })

  it('extends a tap selection to a phrase', async () => {
    const restore = makeCoarsePointer()
    try {
      stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
      renderDialog()

      const paragraph = await screen.findByText('Le fantôme existait.')
      stubCaretAt(paragraph.firstChild as Node, [1, 8])
      stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])
      stubRect(paragraph.closest('.reader-scroll') as Element, {
        top: 150,
        left: 60,
        bottom: 650,
        right: 760,
        width: 700,
        height: 500,
      })

      tap(paragraph, 150, 310)
      tap(paragraph, 170, 310)

      fireEvent.click(await screen.findByRole('button', { name: 'Add to vocab' }))
      await waitFor(() =>
        expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('le fantôme')
      )
    } finally {
      restore()
    }
  })

  it('selects a multi-word range by holding a word and dragging', async () => {
    const restore = makeCoarsePointer()
    try {
      stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
      renderDialog()

      const paragraph = await screen.findByText('Le fantôme existait.')
      stubCaretSequence([
        { node: paragraph.firstChild as Node, offset: 1 },
        { node: paragraph.firstChild as Node, offset: 15 },
      ])
      stubLineRects([
        { top: 300, bottom: 320, left: 140, width: 150, height: 20 },
        { top: 320, bottom: 340, left: 140, width: 90, height: 20 },
      ])
      const reader = paragraph.closest('.reader-scroll') as Element
      stubRect(screen.getByRole('dialog'), {
        top: 100,
        left: 50,
        bottom: 700,
        right: 850,
        width: 800,
        height: 600,
      })
      stubRect(reader, {
        top: 150,
        left: 60,
        bottom: 650,
        right: 760,
        width: 700,
        height: 500,
      })

      fireEvent.touchStart(paragraph, {
        touches: [{ clientX: 150, clientY: 310, identifier: 1 }],
        changedTouches: [{ clientX: 150, clientY: 310, identifier: 1 }],
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })

      fireEvent.touchMove(reader, {
        touches: [{ clientX: 220, clientY: 330, identifier: 1 }],
        changedTouches: [{ clientX: 220, clientY: 330, identifier: 1 }],
      })
      fireEvent.touchEnd(reader, {
        touches: [],
        changedTouches: [{ clientX: 220, clientY: 330, identifier: 1 }],
      })

      fireEvent.click(await screen.findByRole('button', { name: 'Add to vocab' }))

      await waitFor(() =>
        expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('le fantôme existait')
      )
    } finally {
      restore()
    }
  })

  it('starts a new selection on the third tap', async () => {
    const restore = makeCoarsePointer()
    try {
      stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
      renderDialog()

      const paragraph = await screen.findByText('Le fantôme existait.')
      stubCaretAt(paragraph.firstChild as Node, [1, 8, 13])
      stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])
      stubRect(paragraph.closest('.reader-scroll') as Element, {
        top: 150,
        left: 60,
        bottom: 650,
        right: 760,
        width: 700,
        height: 500,
      })

      tap(paragraph, 150, 310)
      tap(paragraph, 170, 310)
      tap(paragraph, 190, 310)

      fireEvent.click(await screen.findByRole('button', { name: 'Add to vocab' }))
      await waitFor(() =>
        expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('existait')
      )
    } finally {
      restore()
    }
  })

  it('ignores a touch that moves far enough to be a scroll', async () => {
    const restore = makeCoarsePointer()
    try {
      stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
      renderDialog()

      const paragraph = await screen.findByText('Le fantôme existait.')
      stubCaretAt(paragraph.firstChild as Node, [3])
      fireEvent.touchStart(paragraph, {
        touches: [{ clientX: 150, clientY: 310 }],
        changedTouches: [{ clientX: 150, clientY: 310 }],
      })
      fireEvent.touchEnd(paragraph, {
        touches: [{ clientX: 150, clientY: 370 }],
        changedTouches: [{ clientX: 150, clientY: 370 }],
      })

      expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
    } finally {
      restore()
    }
  })

  it('does not select a word when the tap lands in the reader padding', async () => {
    const restore = makeCoarsePointer()
    try {
      stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
      renderDialog()

      const paragraph = await screen.findByText('Le fantôme existait.')
      stubCaretAt(paragraph.firstChild as Node, [3])
      stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])

      tap(paragraph, 20, 120)

      expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
    } finally {
      restore()
    }
  })

  it('keeps a space when a phrase spans two rendered lines', async () => {
    const restore = makeCoarsePointer()
    try {
      stubFetch({ ok: true, text: async () => WRAPPED_TEXT })
      renderDialog()

      const first = await screen.findByText('Le fantôme')
      const second = await screen.findByText('existait ici.')
      stubCaretSequence([
        { node: first.firstChild as Node, offset: 1 },
        { node: second.firstChild as Node, offset: 3 },
      ])
      stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])
      stubRect(screen.getByRole('dialog'), {
        top: 100,
        left: 50,
        bottom: 700,
        right: 850,
        width: 800,
        height: 600,
      })
      stubRect(first.closest('.reader-scroll') as Element, {
        top: 150,
        left: 60,
        bottom: 650,
        right: 760,
        width: 700,
        height: 500,
      })

      tap(first, 150, 310)
      tap(second, 170, 310)

      fireEvent.click(await screen.findByRole('button', { name: 'Add to vocab' }))
      await waitFor(() =>
        expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('le fantôme existait')
      )
    } finally {
      restore()
    }
  })

  it('clears the touch selection when the reader scrolls or the page changes', async () => {
    const restore = makeCoarsePointer()
    try {
      stubFetch({ ok: true, text: async () => MULTI_CHAPTER_TEXT })
      renderDialog()

      const paragraph = await screen.findByText('Le fantôme existait.')
      stubCaretAt(paragraph.firstChild as Node, [3])
      stubLineRects([{ top: 300, bottom: 320, left: 140, width: 90, height: 20 }])
      tap(paragraph)
      await screen.findByRole('button', { name: 'Add to vocab' })

      fireEvent.scroll(paragraph.closest('.reader-scroll') as Element)
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
      )

      stubCaretAt(paragraph.firstChild as Node, [3])
      tap(paragraph)
      await screen.findByRole('button', { name: 'Add to vocab' })
      fireEvent.click(screen.getByRole('button', { name: /Next/ }))

      expect(await screen.findByText('On ne le croyait pas.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
    } finally {
      restore()
    }
  })

  it('hides the pill when the selection collapses', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'fantôme')
    fireEvent.mouseUp(paragraph)
    await screen.findByRole('button', { name: 'Add to vocab' })

    window.getSelection = vi.fn().mockReturnValue({ isCollapsed: true } as unknown as Selection)
    fireEvent(document, new Event('selectionchange'))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
    )
  })

  it('ignores a selection that ends outside the reader', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'fantôme')
    const selection = window.getSelection() as unknown as { focusNode: Node }
    selection.focusNode = document.body
    fireEvent.mouseUp(paragraph)

    expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
  })

  it('captures the phrase when the pill is pressed without collapsing the selection', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'fantôme existait')
    fireEvent.mouseUp(paragraph)

    const pill = await screen.findByRole('button', { name: 'Add to vocab' })
    fireEvent.pointerDown(pill)
    fireEvent.click(pill)

    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme existait')
    )
  })

  it('captures the phrase from a touch release on the pill', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'fantôme')
    fireEvent.mouseUp(paragraph)

    const pill = await screen.findByRole('button', { name: 'Add to vocab' })
    fireEvent.touchEnd(pill)

    await waitFor(() =>
      expect(screen.getByPlaceholderText('e.g. hund')).toHaveValue('fantôme')
    )
  })

  it('places the pill in the dialog space and inside the visible reader band', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubRect(screen.getByRole('dialog'), {
      top: 100,
      left: 50,
      bottom: 700,
      right: 850,
      width: 800,
      height: 600,
    })
    stubSelection(
      paragraph,
      'fantôme',
      { top: 300, bottom: 320, left: 200, width: 90, height: 20 },
      { top: 150, left: 60, bottom: 550, right: 760, width: 700, height: 400 }
    )
    fireEvent.mouseUp(paragraph)

    const pill = await screen.findByRole('button', { name: 'Add to vocab' })
    expect(pill).toHaveStyle({ top: '154px', left: '131px' })
  })

  it('hides the pill when the selected text has scrolled out of the reader', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'fantôme', {
      top: 800,
      bottom: 820,
      left: 20,
      width: 90,
      height: 20,
    })
    fireEvent.mouseUp(paragraph)

    expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
  })

  it('hides the pill when the page changes', async () => {
    stubFetch({ ok: true, text: async () => MULTI_CHAPTER_TEXT })
    renderDialog()

    const paragraph = await screen.findByText('Le fantôme existait.')
    stubSelection(paragraph, 'fantôme')
    fireEvent.mouseUp(paragraph)
    await screen.findByRole('button', { name: 'Add to vocab' })

    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    expect(await screen.findByText('On ne le croyait pas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to vocab' })).toBeNull()
  })

  it('paginates chapters with prev and next navigation', async () => {
    stubFetch({ ok: true, text: async () => MULTI_CHAPTER_TEXT })
    renderDialog()

    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
    expect(screen.queryByText('On ne le croyait pas.')).toBeNull()
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    expect(await screen.findByText('On ne le croyait pas.')).toBeInTheDocument()
    expect(screen.queryByText('Le fantôme existait.')).toBeNull()
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Prev/ }))
    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
  })

  it('fills the viewport instead of using a capped dialog size', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    await screen.findByText('Le fantôme existait.')

    expect(screen.getByRole('dialog')).toHaveClass('h-[100dvh]', 'max-w-none', 'w-full')
  })

  it('opens the reader with a single close control', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    renderDialog()

    expect(await screen.findByText('Le fantôme existait.')).toBeInTheDocument()
    // The shared DialogContent renders its own close button; the reader also places one in
    // the header, and two overlapping X icons in the same corner are not a usable control.
    expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1)
  })

  it('opens the global Ask AI panel with the book context', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BookReaderDialog book={book} language="French" onClose={vi.fn()} />
          <AiTutorDock />
        </MemoryRouter>
      </QueryClientProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Ask AI about this book' }))

    expect(await screen.findByRole('heading', { name: 'Ask AI' })).toBeInTheDocument()
    expect(await screen.findByText(/About Le Fantôme de l’Opéra/)).toBeInTheDocument()
  })

  it('closes the reader from its close button', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    const onClose = vi.fn()
    renderDialog({}, onClose)

    fireEvent.click(await screen.findByRole('button', { name: 'Close reader' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('stays open when clicking outside or pressing Escape', async () => {
    stubFetch({ ok: true, text: async () => SAMPLE_TEXT })
    const onClose = vi.fn()
    renderDialog({}, onClose)

    await screen.findByText('Le fantôme existait.')

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)

    await waitFor(() => expect(onClose).not.toHaveBeenCalled())
  })

  it('advances pages with the right arrow key', async () => {
    stubFetch({ ok: true, text: async () => MULTI_CHAPTER_TEXT })
    renderDialog()

    await screen.findByText('Le fantôme existait.')
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(await screen.findByText('On ne le croyait pas.')).toBeInTheDocument()
  })
})