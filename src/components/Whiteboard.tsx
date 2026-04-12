import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Eraser, Maximize2, Minimize2, Minus, Palette, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Purple', value: '#a855f7' },
]

interface WhiteboardProps {
  onClose: () => void
  height: number
  onHeightChange: (height: number) => void
}

const Whiteboard = ({ onClose, height, onHeightChange }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#ffffff')
  const [lineWidth, setLineWidth] = useState(3)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Resize canvas to fill container safely while keeping drawings
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Save current drawing
    const imageData = ctx.getImageData(0, 0, canvas.width || 1, canvas.height || 1)

    canvas.width = parent.clientWidth
    canvas.height = parent.clientHeight

    // Restore drawing
    ctx.putImageData(imageData, 0, 0)
  }, [])

  // Use a debounced ResizeObserver to handle width/height animations perfectly
  useEffect(() => {
    const parent = canvasRef.current?.parentElement
    if (!parent) return

    let timeoutId: NodeJS.Timeout
    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        resizeCanvas()
      }, 150)
    })

    observer.observe(parent)
    resizeCanvas() // Initial call

    return () => {
      observer.disconnect()
      clearTimeout(timeoutId)
    }
  }, [resizeCanvas])

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const getTouchPos = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    }
  }, [])

  const startDraw = useCallback((pos: { x: number; y: number }) => {
    setIsDrawing(true)
    lastPos.current = pos
  }, [])

  const draw = useCallback(
    (pos: { x: number; y: number }) => {
      if (!isDrawing || !lastPos.current) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPos.current = pos
    },
    [isDrawing, color, lineWidth]
  )

  const stopDraw = useCallback(() => {
    setIsDrawing(false)
    lastPos.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const increaseHeight = useCallback(
    () => onHeightChange(Math.min(90, height + 10)),
    [height, onHeightChange]
  )
  const decreaseHeight = useCallback(
    () => onHeightChange(Math.max(30, height - 10)),
    [height, onHeightChange]
  )
  const increaseStroke = useCallback(() => setLineWidth((w) => Math.min(20, w + 1)), [])
  const decreaseStroke = useCallback(() => setLineWidth((w) => Math.max(1, w - 1)), [])

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0 min-w-max">
        <span className="font-mono text-xs text-muted-foreground mr-auto hidden sm:block">
          Whiteboard
        </span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs h-8">
              <div
                className="w-3 h-3 rounded-full border border-border"
                style={{ backgroundColor: color }}
              />
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
                    borderColor: color === c.value ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* STROKE WIDTH CONTROLS - Made more prominent */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-md border border-border px-1 h-8">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-background"
            onClick={decreaseStroke}
            title="Decrease stroke line width">
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-[10px] font-mono font-bold w-12 text-center text-foreground flex flex-col leading-none">
            <span className="text-muted-foreground font-normal text-[8px]">STROKE</span>
            {lineWidth}px
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-background"
            onClick={increaseStroke}
            title="Increase stroke line width">
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 font-mono text-xs h-8"
          onClick={clearCanvas}>
          <Eraser className="h-3 w-3" /> Clear
        </Button>

        {/* Height Controls */}
        <div className="flex items-center gap-1 border-l border-border pl-2 ml-1 h-8">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={decreaseHeight}
            title="Decrease panel height">
            <Minimize2 className="h-3 w-3" />
          </Button>
          <span className="text-[10px] font-mono text-muted-foreground w-8 text-center flex flex-col leading-none">
            <span className="text-[8px]">HEIGHT</span>
            {height}vh
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={increaseHeight}
            title="Increase panel height">
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive ml-1"
          onClick={onClose}>
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
          onTouchStart={(e) => {
            e.preventDefault()
            startDraw(getTouchPos(e))
          }}
          onTouchMove={(e) => {
            e.preventDefault()
            draw(getTouchPos(e))
          }}
          onTouchEnd={stopDraw}
        />
      </div>
    </div>
  )
}

export default Whiteboard
