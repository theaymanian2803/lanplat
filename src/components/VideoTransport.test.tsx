import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import VideoTransport from '@/components/VideoTransport'

describe('VideoTransport', () => {
  it('reports play, rewind and forward presses', () => {
    const onPlayPause = vi.fn()
    const onRewind = vi.fn()
    const onForward = vi.fn()
    render(
      <VideoTransport
        isPlaying={false}
        onPlayPause={onPlayPause}
        onRewind={onRewind}
        onForward={onForward}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Play video' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rewind 10 seconds' }))
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 seconds' }))

    expect(onPlayPause).toHaveBeenCalledTimes(1)
    expect(onRewind).toHaveBeenCalledTimes(1)
    expect(onForward).toHaveBeenCalledTimes(1)
  })

  it('shows pause while the video is playing', () => {
    render(
      <VideoTransport
        isPlaying
        onPlayPause={vi.fn()}
        onRewind={vi.fn()}
        onForward={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument()
  })

  it('toggles the video captions next to the seek buttons', () => {
    const onToggleCaptions = vi.fn()
    const { rerender } = render(
      <VideoTransport
        isPlaying={false}
        onPlayPause={vi.fn()}
        onRewind={vi.fn()}
        onForward={vi.fn()}
        captionsOn={false}
        onToggleCaptions={onToggleCaptions}
      />
    )

    const cc = screen.getByRole('button', { name: 'Turn captions on' })
    expect(cc).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(cc)
    expect(onToggleCaptions).toHaveBeenCalledTimes(1)

    rerender(
      <VideoTransport
        isPlaying={false}
        onPlayPause={vi.fn()}
        onRewind={vi.fn()}
        onForward={vi.fn()}
        captionsOn
        onToggleCaptions={onToggleCaptions}
      />
    )

    expect(screen.getByRole('button', { name: 'Turn captions off' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('hides the captions button when the caller supplies no toggle', () => {
    render(
      <VideoTransport
        isPlaying={false}
        onPlayPause={vi.fn()}
        onRewind={vi.fn()}
        onForward={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /captions/i })).toBeNull()
  })
})
