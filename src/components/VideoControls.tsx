import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gauge, Repeat, X } from "lucide-react";
import { formatTimestamp } from "@/lib/youtube";
import type { YouTubePlayer } from "@/lib/youtubePlayer";

interface VideoControlsProps {
  playerRef: React.MutableRefObject<YouTubePlayer | null>;
  loopA: number | null;
  loopB: number | null;
  onSetA: () => void;
  onSetB: () => void;
  onClearLoop: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

const VideoControls = ({ playerRef, loopA, loopB, onSetA, onSetB, onClearLoop }: VideoControlsProps) => {
  const [speed, setSpeed] = useState(() => {
    const rate = playerRef.current?.getPlaybackRate?.();
    return typeof rate === "number" && rate > 0 ? rate : 1;
  });

  const changeSpeed = (s: number) => {
    setSpeed(s);
    playerRef.current?.setPlaybackRate?.(s);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="mono-label mr-1 text-muted-foreground">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => changeSpeed(s)}
            className={`h-7 rounded-sm border px-2 font-mono text-[11px] transition-colors ${
              speed === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1">
        <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
        <Button
          variant={loopA !== null ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-2 font-mono text-[11px]"
          onClick={onSetA}
        >
          {loopA !== null ? `A ${formatTimestamp(loopA)}` : "Set A"}
        </Button>
        <Button
          variant={loopB !== null ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-2 font-mono text-[11px]"
          onClick={onSetB}
          disabled={loopA === null}
        >
          {loopB !== null ? `B ${formatTimestamp(loopB)}` : "Set B"}
        </Button>
        {(loopA !== null || loopB !== null) && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearLoop}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default VideoControls;
