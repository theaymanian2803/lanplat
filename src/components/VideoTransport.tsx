import { Captions, CaptionsOff, Forward, Pause, Play, Rewind } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface VideoTransportProps {
  isPlaying: boolean
  onPlayPause: () => void
  onRewind: () => void
  onForward: () => void
  /** Captions are only rendered when a toggle handler is supplied. */
  captionsOn?: boolean
  onToggleCaptions?: () => void
  className?: string
}

/** Compact play / -10s / +10s / CC row used wherever the learner controls the video. */
const VideoTransport = ({
  isPlaying,
  onPlayPause,
  onRewind,
  onForward,
  captionsOn = false,
  onToggleCaptions,
  className = '',
}: VideoTransportProps) => (
  <div className={`flex items-center gap-1 ${className}`}>
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      title="Rewind 10 seconds"
      aria-label="Rewind 10 seconds"
      onClick={onRewind}
    >
      <Rewind className="h-4 w-4" />
    </Button>
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className="h-9 w-9"
      title={isPlaying ? 'Pause video' : 'Play video'}
      aria-label={isPlaying ? 'Pause video' : 'Play video'}
      onClick={onPlayPause}
    >
      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
    </Button>
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      title="Forward 10 seconds"
      aria-label="Forward 10 seconds"
      onClick={onForward}
    >
      <Forward className="h-4 w-4" />
    </Button>
    {onToggleCaptions ? (
      <Button
        type="button"
        size="icon"
        variant={captionsOn ? 'secondary' : 'ghost'}
        className={`h-8 w-8 ${
          captionsOn ? '' : 'text-muted-foreground hover:text-foreground'
        }`}
        title={captionsOn ? 'Turn captions off' : 'Turn captions on'}
        aria-label={captionsOn ? 'Turn captions off' : 'Turn captions on'}
        aria-pressed={captionsOn}
        onClick={onToggleCaptions}
      >
        {captionsOn ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
      </Button>
    ) : null}
  </div>
)

export default VideoTransport
