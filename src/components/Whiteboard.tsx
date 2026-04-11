import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, X, Palette, Maximize2, Minimize2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const COLORS = [
  { label: "White", value: "#ffffff" },
  { label: "Red", value: "#ef4444" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#22c55e" },
  { label: "Yellow", value: "#eab308" },
  { label: "Orange", value: "#f97316" },
  { label: "Purple", value: "#a855f7" },
];

interface WhiteboardProps {
  onClose: () => void;
  height: number;
  onHeightChange: (height: number) => void;
}

const Whiteboard = ({ onClose, height, onHeightChange }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#ffffff");
  const [lineWidth] = useState(3);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Resize canvas to fill container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Save current drawing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    // Restore drawing
    ctx.putImageData(imageData, 0, 0);
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const startDraw = (pos: { x: number; y: number }) => {
    setIsDrawing(true);
    lastPos.current = pos;
  };

  const draw = (pos: { x: number; y: number }) => {
    if (!isDrawing || !lastPos.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const increaseHeight = () => onHeightChange(Math.min(90, height + 10));
  const decreaseHeight = () => onHeightChange(Math.max(30, height - 10));

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <span className="font-mono text-xs text-muted-foreground mr-auto">Whiteboard</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs h-7">
              <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: color }} />
              <Palette className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: color === c.value ? "hsl(var(--primary))" : "hsl(var(--border))",
                  }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs h-7" onClick={clearCanvas}>
          <Eraser className="h-3 w-3" /> Clear
        </Button>

        <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={decreaseHeight}
            title="Decrease height"
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground">{height}vh</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={increaseHeight}
            title="Increase height"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative cursor-crosshair">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onMouseDown={(e) => startDraw(getPos(e))}
          onMouseMove={(e) => draw(getPos(e))}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={(e) => { e.preventDefault(); startDraw(getTouchPos(e)); }}
          onTouchMove={(e) => { e.preventDefault(); draw(getTouchPos(e)); }}
          onTouchEnd={stopDraw}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
