import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import TranscriptStrip from '@/components/TranscriptStrip'
import { getWordRangeAtPoint } from '@/lib/textSelection'
import { loadTranscript, type TranscriptPayload } from '@/lib/youtubeTranscript'
import type { YouTubePlayer } from '@/lib/youtubePlayer'

vi.mock('@/lib/youtubeTranscript', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/youtubeTranscript')>()
  return {
    ...actual,
    loadTranscript: vi.fn(),
    hasCachedTranscript: vi.fn(() => false),
  }
})

vi.mock('@/lib/textSelection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/textSelection')>()
  return { ...actual, getWordRangeAtPoint: vi.fn() }
})

const payload: TranscriptPayload = {
  videoId: 'abcdefghijk',
  languageCode: 'da',
  isGenerated: false,
  tracks: [],
  cues: [{ start: 0, dur: 1.5, text: 'hej verden' }],
}

interface StripOptions {
  captureOpen?: boolean
  savedToken?: number
  playerRef?: React.MutableRefObject<YouTubePlayer | null>
  transportControls?: React.ReactNode
}

function renderStrip(videoId = 'abcdefghijk', options: StripOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const playerRef =
    options.playerRef ?? ({ current: null } as React.MutableRefObject<YouTubePlayer | null>)
  const onWord = vi.fn()
  const tree = (id: string, next: StripOptions = {}) => (
    <QueryClientProvider client={client}>
      <TranscriptStrip
        videoId={id}
        language="Danish"
        playerRef={playerRef}
        captureOpen={next.captureOpen ?? options.captureOpen ?? false}
        savedToken={next.savedToken ?? options.savedToken ?? 0}
        onPause={vi.fn()}
        onSeekPause={vi.fn()}
        onWord={onWord}
        controls={<div />}
        transportControls={next.transportControls ?? options.transportControls}
      />
    </QueryClientProvider>
  )
  const view = render(tree(videoId))
  return {
    ...view,
    onWord,
    showVideo: (id: string, next?: StripOptions) => view.rerender(tree(id, next)),
    showOptions: (next: StripOptions) => view.rerender(tree(videoId, next)),
  }
}

function mockTouchWord(cueText: HTMLElement, word = 'hej') {
  vi.mocked(getWordRangeAtPoint).mockReturnValue({
    text: word,
    range: {
      startContainer: cueText.firstChild as Text,
      getBoundingClientRect: () => ({
        top: 20,
        bottom: 40,
        left: 20,
        width: 60,
        height: 20,
      }),
    } as unknown as Range,
  })
}

describe('TranscriptStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadTranscript).mockResolvedValue(payload)
  })

  it('shows transport controls in the header even while the transcript is off', () => {
    renderStrip('abcdefghijk', {
      transportControls: <button type="button">Play video</button>,
    })

    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('does not request a transcript until it is switched on', async () => {
    renderStrip()

    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByText('off · 1 request')).toBeInTheDocument()
    expect(loadTranscript).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('switch'))

    expect(await screen.findByText('hej verden')).toBeInTheDocument()
    expect(loadTranscript).toHaveBeenCalledTimes(1)
    expect(loadTranscript).toHaveBeenCalledWith('abcdefghijk', 'da')
  })

  it('hides the loaded transcript when switched off, without refetching', async () => {
    renderStrip()
    fireEvent.click(screen.getByRole('switch'))
    await screen.findByText('hej verden')

    fireEvent.click(screen.getByRole('switch'))

    expect(screen.queryByText('hej verden')).toBeNull()
    expect(loadTranscript).toHaveBeenCalledTimes(1)
  })

  it('starts off again when the video changes', async () => {
    const { showVideo } = renderStrip()
    fireEvent.click(screen.getByRole('switch'))
    await screen.findByText('hej verden')

    showVideo('zzzzzzzzzzz')

    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(loadTranscript).toHaveBeenCalledTimes(1)
  })

  it('waits for Add to vocab before opening the form', async () => {
    const { onWord } = renderStrip()
    fireEvent.click(screen.getByRole('switch'))
    const cueText = await screen.findByText('hej verden')
    mockTouchWord(cueText)
    const list = cueText.closest('[data-cue-index]')?.parentElement as HTMLElement
    const tap = () => {
      fireEvent.touchStart(list, { touches: [{ clientX: 30, clientY: 30 }] })
      fireEvent.touchEnd(list, { changedTouches: [{ clientX: 30, clientY: 30 }] })
    }

    tap()
    tap()

    expect(onWord).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: /add to vocab/i }))
    expect(onWord).toHaveBeenCalledWith('hej', expect.stringContaining('hej verden'))
  })

  it('keeps following the player while the vocab form is open', async () => {
    vi.mocked(loadTranscript).mockResolvedValue({
      ...payload,
      cues: [
        { start: 0, dur: 1, text: 'første' },
        { start: 5, dur: 1, text: 'anden' },
      ],
    })
    const playerRef = {
      current: { getCurrentTime: () => 6 } as unknown as YouTubePlayer,
    }
    renderStrip('abcdefghijk', { captureOpen: true, playerRef })
    fireEvent.click(screen.getByRole('switch'))
    const second = (await screen.findByText('anden')).closest('[data-cue-index]')

    await waitFor(() => expect(second).toHaveAttribute('aria-current', 'true'))
  })

  it('can select another word while the form is open', async () => {
    const { onWord } = renderStrip('abcdefghijk', { captureOpen: true })
    fireEvent.click(screen.getByRole('switch'))
    const cueText = await screen.findByText('hej verden')
    mockTouchWord(cueText, 'verden')
    const list = cueText.closest('[data-cue-index]')?.parentElement as HTMLElement
    const tap = () => {
      fireEvent.touchStart(list, { touches: [{ clientX: 30, clientY: 30 }] })
      fireEvent.touchEnd(list, { changedTouches: [{ clientX: 30, clientY: 30 }] })
    }

    tap()
    tap()

    fireEvent.click(await screen.findByRole('button', { name: /add to vocab/i }))
    expect(onWord).toHaveBeenCalledWith('verden', expect.stringContaining('hej verden'))
  })
})
