import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Eraser, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

const DRAW_COLORS = ['#FFD60A', '#FF3B30', '#00E5FF', '#FFFFFF', '#9BFF00', '#FF2D92']

type PenMode = 'viewport' | 'contained'

interface PenOverlayProps {
  onClose: () => void
  side?: 'left' | 'right'
  /** `viewport` covers the window; `contained` fills a positioned parent. */
  mode?: PenMode
  /** Optional controls rendered above the colour swatches (the video transport). */
  topControls?: ReactNode
}

const PenOverlay = ({
  onClose,
  side = 'right',
  mode = 'viewport',
  topControls,
}: PenOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [strokeColor, setStrokeColor] = useState(DRAW_COLORS[0])
  const [isEraser, setIsEraser] = useState(false)
  const strokesRef = useRef<Array<{ color: string; eraser: boolean; points: Array<[number, number]> }>>(
    [],
  )
  const drawingRef = useRef({ active: false, lastX: 0, lastY: 0 })

  useEffect(() => {
    strokesRef.current = []
    const canvas = canvasRef.current
    const host = hostRef.current
    if (!canvas || !host) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const stroke of strokesRef.current) {
        ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over'
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.eraser ? 24 : 3
        ctx.beginPath()
        stroke.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    let resizeRAF: number | null = null
    const resize = () => {
      if (resizeRAF !== null) cancelAnimationFrame(resizeRAF)
      resizeRAF = requestAnimationFrame(() => {
        resizeRAF = null
        const width = mode === 'viewport' ? window.innerWidth : host.clientWidth
        const height = mode === 'viewport' ? window.innerHeight : host.clientHeight
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.max(1, Math.floor(width * dpr))
        canvas.height = Math.max(1, Math.floor(height * dpr))
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        redraw()
      })
    }

    resize()
    const observer =
      mode === 'contained' && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resize)
        : null
    observer?.observe(host)
    window.addEventListener('resize', resize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      if (resizeRAF !== null) cancelAnimationFrame(resizeRAF)
      strokesRef.current = []
    }
  }, [mode])

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = getCanvasPoint(e)
    drawingRef.current = { active: true, lastX: p.x, lastY: p.y }
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = isEraser ? '#ffffff' : strokeColor
    ctx.lineWidth = isEraser ? 24 : 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.01, p.y + 0.01)
    ctx.stroke()
    strokesRef.current.push({
      color: isEraser ? '#ffffff' : strokeColor,
      eraser: isEraser,
      points: [[p.x, p.y]],
    })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.active) return
    e.preventDefault()
    const p = getCanvasPoint(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(drawingRef.current.lastX, drawingRef.current.lastY)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    strokesRef.current[strokesRef.current.length - 1].points.push([p.x, p.y])
    drawingRef.current.lastX = p.x
    drawingRef.current.lastY = p.y
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.active) return
    e.preventDefault()
    drawingRef.current.active = false
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const clearCanvas = () => {
    strokesRef.current = []
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <div
      ref={hostRef}
      className={cn(
        mode === 'viewport' ? 'fixed inset-0 z-[100]' : 'absolute inset-0 z-20',
      )}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div
        className={cn(
          'absolute top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 rounded-xl border border-white/15 bg-black/60 p-2 shadow-lg backdrop-blur-md',
          mode === 'viewport'
            ? side === 'right'
              ? 'right-0'
              : 'left-0'
            : side === 'right'
              ? 'right-2'
              : 'left-2',
        )}>
        {topControls ? (
          <>
            <div className="flex flex-col items-center gap-1.5">{topControls}</div>
            <div className="h-px w-full bg-white/15" />
          </>
        ) : null}
        <div className="flex flex-col items-center gap-1.5">
          {DRAW_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => {
                setIsEraser(false)
                setStrokeColor(c)
              }}
              className={cn(
                'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                strokeColor === c && !isEraser ? 'scale-110 border-white' : 'border-white/30',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="h-px w-full bg-white/15" />
        <Button
          size="icon"
          title="Eraser"
          onClick={() => setIsEraser((v) => !v)}
          className={cn(
            'h-8 w-8 rounded-lg transition-colors',
            isEraser
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-white/10 text-white hover:bg-white/25',
          )}>
          <Eraser className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          title="Clear canvas"
          onClick={clearCanvas}
          className="h-8 w-8 rounded-lg bg-white/10 text-white transition-colors hover:bg-white/25">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          title="Close overlay"
          onClick={onClose}
          className="h-8 w-8 rounded-lg bg-white/10 text-white transition-colors hover:bg-red-500/60">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default PenOverlay
