import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Gauge, Repeat, X } from "lucide-react";
import { formatTimestamp } from "@/lib/youtube";

interface VideoControlsProps {
  playerRef: React.MutableRefObject<any>;
  loopA: number | null;
  loopB: number | null;
  onSetA: () => void;
  onSetB: () => void;
  onClearLoop: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

const VideoControls = ({ playerRef, loopA, loopB, onSetA, onSetB, onClearLoop }: VideoControlsProps) => {
  const [speed, setSpeed] = useState(1);

  const changeSpeed = (s: number) => {
    setSpeed(s);
    playerRef.current?.setPlaybackRate?.(s);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Speed */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs">
            <Gauge className="h-3.5 w-3.5" />
            {speed}x
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {SPEEDS.map((s) => (
            <DropdownMenuItem key={s} onClick={() => changeSpeed(s)} className="font-mono text-xs">
              {s}x {s === speed && "✓"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* A-B Loop */}
      <div className="flex items-center gap-1.5 border border-border/50 rounded-md px-2 py-1">
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
