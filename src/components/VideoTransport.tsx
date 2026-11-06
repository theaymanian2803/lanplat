import { Forward, Pause, Play, Rewind } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface VideoTransportProps {
  isPlaying: boolean
  onPlayPause: () => void
  onRewind: () => void
  onForward: () => void
  className?: string
}

/** Compact play / -10s / +10s row used wherever the learner controls the video. */
const VideoTransport = ({
  isPlaying,
  onPlayPause,
  onRewind,
  onForward,
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
  </div>
)

export default VideoTransport
