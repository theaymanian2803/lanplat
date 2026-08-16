import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Eraser,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  PenTool,
  Plus,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, memo } from 'react'

const COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
  { label: 'Slate', value: '#475569' },
  { label: 'Gray', value: '#9ca3af' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Crimson', value: '#dc2626' },
  { label: 'Maroon', value: '#7f1d1d' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#eab308' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Lime', value: '#84cc16' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Forest', value: '#15803d' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Navy', value: '#1e3a8a' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Fuchsia', value: '#d946ef' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Brown', value: '#92400e' },
]

interface WhiteboardProps {
  onClose: () => void
  height: number
  onHeightChange: (height: number) => void
  backgroundColor?: string
  floating?: boolean
  minimal?: boolean
  defaultColor?: string
}

type Point = { x: number; y: number; p?: number }

type TextNode = {
  id: string
  x: number
  y: number
  text: string
  color: string
  size: number
}

type Stroke = {
  id: string
  type: 'freehand' | 'line'
  points: Point[]
  color: string
  width: number
}

type ToolMode = 'draw' | 'line' | 'text' | 'erase'

const distToSegment = (p: Point, v: Point, w: Point) => {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y)
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)))
}

const strokeWidthAt = (base: number, p?: number) =>
  typeof p === 'number' && p > 0
    ? Math.max(0.6, base * (0.12 + 0.88 * Math.pow(Math.min(1, p), 0.7)))
    : base

const smoothPressure = (pts: Point[]): Point[] => {
  if (pts.length < 3) return pts
  const out: Point[] = new Array(pts.length)
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i]
    if (cur.p === undefined) {
      out[i] = cur
      continue
    }
    const prev = pts[i - 1]
    const next = pts[i + 1]
    let sum = cur.p
    let count = 1
    if (prev?.p !== undefined) {
      sum += prev.p
      count++
    }
    if (next?.p !== undefined) {
      sum += next.p
      count++
    }
    out[i] = { ...cur, p: sum / count }
  }
  return out
}

const smoothPath = (pts: Point[]): Point[] => {
  if (pts.length < 3) return pts
  const out: Point[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    out.push({
      x: (p0.x + p1.x * 2 + p2.x) / 4,
      y: (p0.y + p1.y * 2 + p2.y) / 4,
      p: p1.p,
    })
  }
  out.push(pts[pts.length - 1])
  return out
}

const drawVariableWidthStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke, pts: Point[]) => {
  const ws = pts.map((p) => strokeWidthAt(stroke.width, p.p) / 2)

  ctx.fillStyle = stroke.color
  ctx.beginPath()

  const left: Point[] = []
  const right: Point[] = []

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const w = ws[i]

    let tx: number
    let ty: number
    if (i === 0) {
      tx = pts[1].x - p.x
      ty = pts[1].y - p.y
    } else if (i === pts.length - 1) {
      tx = p.x - pts[i - 1].x
      ty = p.y - pts[i - 1].y
    } else {
      tx = pts[i + 1].x - pts[i - 1].x
      ty = pts[i + 1].y - pts[i - 1].y
    }
    const len = Math.hypot(tx, ty) || 1
    const nx = -ty / len
    const ny = tx / len

    left.push({ x: p.x + nx * w, y: p.y + ny * w })
    right.push({ x: p.x - nx * w, y: p.y - ny * w })
  }

  ctx.moveTo(left[0].x, left[0].y)
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y)
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.arc(pts[0].x, pts[0].y, ws[0], 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, ws[ws.length - 1], 0, Math.PI * 2)
  ctx.fill()
}

const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  const pts = stroke.points
  if (pts.length === 0) return

  ctx.strokeStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (stroke.type === 'line') {
    ctx.lineWidth = stroke.width
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    const last = pts[pts.length - 1]
    ctx.lineTo(last.x, last.y)
    ctx.stroke()
    return
  }

  if (pts.length === 1) {
    const w = strokeWidthAt(stroke.width, pts[0].p)
    ctx.fillStyle = stroke.color
    ctx.beginPath()
    ctx.arc(pts[0].x, pts[0].y, Math.max(0.5, w / 2), 0, Math.PI * 2)
    ctx.fill()
    return
  }

  if (pts.length === 2) {
    ctx.lineWidth = strokeWidthAt(stroke.width, pts[1].p)
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    ctx.lineTo(pts[1].x, pts[1].y)
    ctx.stroke()
    return
  }

  const hasPressure = pts.some((pt) => pt.p !== undefined)
  const smoothed = hasPressure ? smoothPressure(smoothPath(pts)) : pts

  if (!hasPressure) {
    ctx.lineWidth = stroke.width
    ctx.beginPath()
    ctx.moveTo(smoothed[0].x, smoothed[0].y)
    for (let i = 1; i < smoothed.length - 1; i++) {
      const p1 = smoothed[i]
      const p2 = smoothed[i + 1]
      ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
    }
    const last = smoothed[smoothed.length - 1]
    ctx.lineTo(last.x, last.y)
    ctx.stroke()
    return
  }

  drawVariableWidthStroke(ctx, stroke, smoothed)
}

const Whiteboard = ({ onClose, height, onHeightChange, backgroundColor, floating, minimal, defaultColor }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState(defaultColor ?? '#ffffff')
  const [lineWidth, setLineWidth] = useState(3)
  const [mode, setMode] = useState<ToolMode>('draw')

  const [textNodes, setTextNodes] = useState<TextNode[]>([])
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null)

  const strokesRef = useRef<Stroke[]>([])
  const currentStrokeRef = useRef<Stroke | null>(null)
  const strokeStateRef = useRef<{ lastMid: Point; lastPoint: Point } | null>(null)
  const pendingFrameRef = useRef<number | null>(null)
  const bodyPointerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isTextModalOpen, setIsTextModalOpen] = useState(false)
  const [textVal, setTextVal] = useState('')
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const [isGridModalOpen, setIsGridModalOpen] = useState(false)
  const [gridStart, setGridStart] = useState(1)
  const [gridEnd, setGridEnd] = useState(40)
  const [gridRowsPerCol, setGridRowsPerCol] = useState(10)

  useEffect(() => {
    if (!isTextModalOpen && !isGridModalOpen) {
      if (bodyPointerTimeoutRef.current) clearTimeout(bodyPointerTimeoutRef.current)
      bodyPointerTimeoutRef.current = setTimeout(() => {
        document.body.style.pointerEvents = ''
        bodyPointerTimeoutRef.current = null
      }, 100)
    }
    return () => {
      if (bodyPointerTimeoutRef.current) {
        clearTimeout(bodyPointerTimeoutRef.current)
        bodyPointerTimeoutRef.current = null
      }
      document.body.style.pointerEvents = ''
    }
  }, [isTextModalOpen, isGridModalOpen])

  useEffect(() => {
    if (isTextModalOpen && textInputRef.current) {
      setTimeout(() => textInputRef.current?.focus(), 150)
    }
  }, [isTextModalOpen])

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const allStrokes = [...strokesRef.current]
    if (currentStrokeRef.current) {
      allStrokes.push(currentStrokeRef.current)
    }

    allStrokes.forEach((stroke) => drawStroke(ctx, stroke))
  }, [])

  const scheduleRedraw = useCallback(() => {
    if (pendingFrameRef.current !== null) return
    pendingFrameRef.current = requestAnimationFrame(() => {
      pendingFrameRef.current = null
      redrawCanvas()
    })
  }, [redrawCanvas])

  const flushPendingRedraw = useCallback(() => {
    if (pendingFrameRef.current !== null) {
      cancelAnimationFrame(pendingFrameRef.current)
      pendingFrameRef.current = null
      redrawCanvas()
    }
  }, [redrawCanvas])

  useEffect(() => {
    return () => {
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current)
        pendingFrameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const parent = containerRef.current
    if (!parent) return

    let resizeRAF: number | null = null
    const resizeCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      redrawCanvas()
    }

    const observer = new ResizeObserver(() => {
      if (resizeRAF !== null) cancelAnimationFrame(resizeRAF)
      resizeRAF = requestAnimationFrame(resizeCanvas)
    })

    observer.observe(parent)
    resizeCanvas()

    return () => {
      observer.disconnect()
      if (resizeRAF !== null) cancelAnimationFrame(resizeRAF)
    }
  }, [redrawCanvas])

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    let clientX, clientY
    let pressure: number | undefined

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }

    if ('pointerType' in e && e.pointerType === 'pen' && typeof e.pressure === 'number') {
      pressure = e.pressure
    }

    return { x: clientX - rect.left, y: clientY - rect.top, p: pressure }
  }, [])

  const startDraw = useCallback(
    (pos: Point) => {
      if (mode === 'text' || mode === 'erase') return
      setIsDrawing(true)
      strokeStateRef.current = null
      currentStrokeRef.current = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 11),
        type: mode === 'line' ? 'line' : 'freehand',
        points: [pos],
        color,
        width: lineWidth,
      }
      redrawCanvas()
    },
    [mode, color, lineWidth, redrawCanvas]
  )

  const draw = useCallback(
    (pos: Point) => {
      if (!isDrawing || !currentStrokeRef.current) return
      const stroke = currentStrokeRef.current

      if (stroke.type === 'line') {
        stroke.points[1] = pos
        scheduleRedraw()
        return
      }

      const pts = stroke.points
      const lastPoint = pts[pts.length - 1]
      if (Math.hypot(pos.x - lastPoint.x, pos.y - lastPoint.y) < 1.5) return
      pts.push(pos)
      scheduleRedraw()
    },
    [isDrawing, scheduleRedraw]
  )

  const stopDraw = useCallback(() => {
    flushPendingRedraw()
    strokeStateRef.current = null
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      strokesRef.current.push(currentStrokeRef.current)
      redrawCanvas()
    }
    currentStrokeRef.current = null
    setIsDrawing(false)
  }, [flushPendingRedraw, redrawCanvas])

  const clearCanvas = useCallback(() => {
    strokesRef.current = []
    setTextNodes([])
    redrawCanvas()
  }, [redrawCanvas])

  const handleAddText = useCallback(() => {
    if (menuPos && textVal.trim() !== '') {
      const newNode: TextNode = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 11),
        x: menuPos.x,
        y: menuPos.y,
        text: textVal,
        color: color,
        size: Math.max(16, lineWidth * 8),
      }
      setTextNodes((prev) => [...prev, newNode])
    }
    setIsTextModalOpen(false)
    setTextVal('')
    setMenuPos(null)
  }, [menuPos, textVal, color, lineWidth])

  const handleGenerateGrid = useCallback(() => {
    if (gridStart > gridEnd || gridRowsPerCol < 1) return

    const newNodes: TextNode[] = []
    const startX = 100
    const startY = 40
    const colSpacing = 80
    const rowSpacing = Math.max(30, lineWidth * 8 * 1.5)

    let currentIndex = 0
    for (let i = gridStart; i <= gridEnd; i++) {
      const col = Math.floor(currentIndex / gridRowsPerCol)
      const row = currentIndex % gridRowsPerCol

      newNodes.push({
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 11),
        x: startX + col * colSpacing,
        y: startY + row * rowSpacing,
        text: i.toString(),
        color: color,
        size: Math.max(16, lineWidth * 8),
      })
      currentIndex++
    }

    setTextNodes((prev) => [...prev, ...newNodes])
    setIsGridModalOpen(false)
  }, [gridStart, gridEnd, gridRowsPerCol, color, lineWidth])

  const eraseObjectsAtPosition = useCallback(
    (pos: Point) => {
      const eraserRadius = Math.max(15, lineWidth * 2)

      setTextNodes((prev) =>
        prev.filter((node) => {
          const approxWidth = node.text.length * node.size * 0.6
          const approxHeight = node.size
          const dx = Math.abs(node.x - pos.x)
          const dy = Math.abs(node.y - pos.y)
          return !(dx < approxWidth / 2 + eraserRadius && dy < approxHeight / 2 + eraserRadius)
        })
      )

      let strokesChanged = false
      strokesRef.current = strokesRef.current.filter((stroke) => {
        let hit = false
        const pts = stroke.points
        if (pts.length === 0) return true
        const threshold = Math.max(15, stroke.width + 10)

        if (stroke.type === 'line') {
          hit = distToSegment(pos, pts[0], pts[pts.length - 1]) < threshold
        } else {
          for (let i = 0; i < pts.length - 1; i++) {
            if (distToSegment(pos, pts[i], pts[i + 1]) < threshold) {
              hit = true
              break
            }
          }
          if (!hit && pts.length === 1) {
            hit = Math.hypot(pos.x - pts[0].x, pos.y - pts[0].y) < threshold
          }
        }

        if (hit) strokesChanged = true
        return !hit
      })

      if (strokesChanged) redrawCanvas()
    },
    [lineWidth, redrawCanvas]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 2) return
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)

      const pos = getPos(e)
      if (mode === 'erase') {
        setIsDrawing(true)
        eraseObjectsAtPosition(pos)
      } else if (e.target === canvasRef.current) {
        startDraw(pos)
      }
    },
    [mode, getPos, eraseObjectsAtPosition, startDraw]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggedTextId) {
        const pos = getPos(e)
        setTextNodes((prev) =>
          prev.map((node) => (node.id === draggedTextId ? { ...node, x: pos.x, y: pos.y } : node))
        )
        return
      }

      if (isDrawing) {
        if (mode === 'erase') {
          eraseObjectsAtPosition(getPos(e))
          return
        }

        const native = e.nativeEvent as PointerEvent
        if (
          native &&
          native.pointerType === 'pen' &&
          typeof native.getCoalescedEvents === 'function'
        ) {
          const events = native.getCoalescedEvents()
          if (events.length > 1) {
            const canvas = canvasRef.current
            const rect = canvas?.getBoundingClientRect()
            for (const ev of events) {
              if (!rect) continue
              const x = ev.clientX - rect.left
              const y = ev.clientY - rect.top
              const p =
                ev.pointerType === 'pen' && typeof ev.pressure === 'number'
                  ? ev.pressure
                  : undefined
              draw({ x, y, p })
            }
            return
          }
        }
        draw(getPos(e))
      }
    },
    [draggedTextId, mode, isDrawing, getPos, eraseObjectsAtPosition, draw]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
      setDraggedTextId(null)
      stopDraw()
    },
    [stopDraw]
  )

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
    <div
      className={`relative h-full w-full border border-border rounded-lg overflow-hidden flex ${
        backgroundColor ? '' : 'bg-background'
      }`}
      style={backgroundColor ? { backgroundColor } : undefined}>
      {/* FLOATING VERTICAL TOOLBAR */}
      <div
        className="absolute left-2 top-2 bottom-2 w-12 flex flex-col items-center gap-3 py-3 bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-xl z-50 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        onPointerDown={(e) => e.stopPropagation()}>
        {/* Tools Toggle */}
        <div className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg p-1">
          <Button
            variant={mode === 'draw' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setMode('draw')}
            title="Pen Tool">
            <PenTool className="h-4 w-4" />
          </Button>
          {!minimal && (
            <Button
              variant={mode === 'line' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setMode('line')}
              title="Straight Line Tool">
              <Minus className="h-4 w-4 -rotate-45 scale-110" />
            </Button>
          )}
          {!minimal && (
            <Button
              variant={mode === 'text' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setMode('text')
                stopDraw()
              }}
              title="Move Numbers / Right Click to Add">
              <Type className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant={mode === 'erase' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setMode('erase')
              stopDraw()
            }}
            title="Smart Object Eraser">
            <Eraser className="h-4 w-4" />
          </Button>
        </div>

        {!minimal && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsGridModalOpen(true)}
            title="Generate Marking Grid">
            <ListOrdered className="h-4 w-4 text-primary" />
          </Button>
        )}

        {/* Color Palette */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <div
                className="w-4 h-4 rounded-full border border-border shadow-sm"
                style={{ backgroundColor: color }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 z-[300]" align="start" side="right" sideOffset={10}>
            <div className="grid grid-cols-5 gap-1.5 max-w-[200px]">
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

        {!minimal && (
          <div className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg p-1 w-[36px]">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={increaseStroke}>
              <Plus className="h-3 w-3" />
            </Button>
            <span className="text-[10px] font-mono font-bold leading-none py-1">{lineWidth}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={decreaseStroke}>
              <Minus className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Clear All */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          onClick={clearCanvas}
          title="Clear Entire Board">
          <Trash2 className="h-4 w-4" />
        </Button>

        {/* Flexible spacer */}
        <div className="flex-1 min-h-[10px]"></div>

        {/* Height Controls */}
        {!floating && (
          <div className="flex flex-col items-center gap-1 border-t border-border pt-2 w-full">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={increaseHeight}>
              <Maximize2 className="h-3 w-3" />
            </Button>
            <span className="text-[9px] font-mono text-muted-foreground my-0.5">{height}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={decreaseHeight}>
              <Minimize2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Close */}
        {!floating && (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-1"
            onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* FULL-WIDTH CANVAS */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={containerRef}
            className="absolute inset-0 z-10 overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={(e) => setMenuPos(getPos(e))}
            style={{ touchAction: 'none' }}>
            {/* The base drawing canvas */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full ${
                mode === 'erase'
                  ? 'cursor-cell'
                  : mode === 'text'
                    ? 'cursor-default'
                    : 'cursor-crosshair'
              }`}
            />

            {/* The Overlay Nodes */}
            {textNodes.map((node) => (
              <div
                key={node.id}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  if (mode === 'erase') {
                    setTextNodes((prev) => prev.filter((n) => n.id !== node.id))
                    setIsDrawing(true)
                  } else {
                    setDraggedTextId(node.id)
                  }
                }}
                className={`absolute ${
                  mode === 'erase'
                    ? 'cursor-cell hover:opacity-50 hover:line-through text-red-500'
                    : 'cursor-grab active:cursor-grabbing hover:ring-2'
                } ring-primary/50 rounded`}
                style={{
                  left: node.x,
                  top: node.y,
                  color: node.color,
                  fontSize: `${node.size}px`,
                  fontFamily: 'sans-serif',
                  fontWeight: 'bold',
                  transform: 'translate(-50%, -50%)',
                  userSelect: 'none',
                  zIndex: 10,
                }}>
                {node.text}
              </div>
            ))}
          </div>
        </ContextMenuTrigger>

        {/* The Dropdown Menu */}
        <ContextMenuContent className="w-48 z-50">
          <ContextMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setTimeout(() => setIsTextModalOpen(true), 100)
            }}
            className="gap-2 cursor-pointer font-mono text-xs">
            <Type className="h-4 w-4 text-muted-foreground" />
            Add Number / Text
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Individual Text Dialog */}
      <Dialog open={isTextModalOpen} onOpenChange={setIsTextModalOpen}>
        <DialogContent
          className="sm:max-w-xs z-[100]"
          onInteractOutside={() => setIsTextModalOpen(false)}>
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Add Text to Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="text-input" className="text-xs text-muted-foreground">
              Value
            </Label>
            <Input
              id="text-input"
              ref={textInputRef}
              placeholder="e.g. 1, 2, 3..."
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddText()
              }}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddText}
              disabled={!textVal.trim()}
              className="w-full font-mono text-xs">
              Add to Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Number Grid Generator Dialog */}
      <Dialog open={isGridModalOpen} onOpenChange={setIsGridModalOpen}>
        <DialogContent
          className="sm:max-w-sm z-[100]"
          onInteractOutside={() => setIsGridModalOpen(false)}>
          <DialogHeader>
            <DialogTitle className="font-mono text-sm flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-primary" />
              Generate Number Grid
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Start Number</Label>
              <Input
                type="number"
                value={gridStart}
                onChange={(e) => setGridStart(Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">End Number</Label>
              <Input
                type="number"
                value={gridEnd}
                onChange={(e) => setGridEnd(Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-xs text-muted-foreground">Rows per Column</Label>
              <Input
                type="number"
                value={gridRowsPerCol}
                onChange={(e) => setGridRowsPerCol(Number(e.target.value))}
                className="font-mono"
                min={1}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                (e.g., 10 rows will stack 1-10 vertically, then start 11-20 in the next column)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleGenerateGrid} className="w-full font-mono text-xs">
              Stamp Grid to Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default memo(Whiteboard)
