import Whiteboard from '@/components/Whiteboard'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Palette, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const SHEET_BG_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#0f172a' },
  { label: 'Slate', value: '#1e293b' },
  { label: 'Navy', value: '#1e3a8a' },
  { label: 'Forest', value: '#14532d' },
  { label: 'Maroon', value: '#7f1d1d' },
  { label: 'Charcoal', value: '#27272a' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#eab308' },
  { label: 'Lime', value: '#84cc16' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Rose', value: '#f43f5e' },
]

type DragState = { offsetX: number; offsetY: number } | null
type ResizeState = {
  startX: number
  startY: number
  origW: number
  origH: number
  edge: string
} | null

const MIN_W = 320
const MIN_H = 240

const Sheet = ({ onClose }: { onClose: () => void }) => {
  const [pos, setPos] = useState({ x: 190, y: 6 })
  const [size, setSize] = useState({ width: 680, height: 440 })
  const [bgColor, setBgColor] = useState('#ffffff')

  const dragRef = useRef<DragState>(null)
  const resizeRef = useRef<ResizeState>(null)
  const sizeRef = useRef(size)
  const posRef = useRef(pos)

  useEffect(() => {
    sizeRef.current = size
  }, [size])
  useEffect(() => {
    posRef.current = pos
  }, [pos])

  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('[role="dialog"]')) return
    e.preventDefault()
    const p = posRef.current
    dragRef.current = {
      offsetX: e.clientX - p.x,
      offsetY: e.clientY - p.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { offsetX, offsetY } = dragRef.current
    const newX = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - offsetX))
    const newY = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY))
    setPos({ x: newX, y: newY })
  }, [])

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    }
  }, [])

  const handleResizeMove = useCallback((e: PointerEvent) => {
    const r = resizeRef.current
    if (!r) return
    const dx = e.clientX - r.startX
    const dy = e.clientY - r.startY
    let newW = r.origW
    let newH = r.origH

    if (r.edge.includes('e')) newW = Math.max(MIN_W, r.origW + dx)
    if (r.edge.includes('s')) newH = Math.max(MIN_H, r.origH + dy)
    if (r.edge.includes('w')) newW = Math.max(MIN_W, r.origW - dx)
    if (r.edge.includes('n')) newH = Math.max(MIN_H, r.origH - dy)

    setSize({ width: newW, height: newH })
  }, [])

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null
    window.removeEventListener('pointermove', handleResizeMove)
    window.removeEventListener('pointerup', handleResizeEnd)
  }, [handleResizeMove])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleResizeMove)
      window.removeEventListener('pointerup', handleResizeEnd)
    }
  }, [handleResizeMove, handleResizeEnd])

  const startResize = useCallback(
    (edge: string) => (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const s = sizeRef.current
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: s.width,
        origH: s.height,
        edge,
      }
      window.addEventListener('pointermove', handleResizeMove)
      window.addEventListener('pointerup', handleResizeEnd)
    },
    [handleResizeMove, handleResizeEnd]
  )

  const handleBgPick = useCallback((c: string) => setBgColor(c), [])

  const resizeHandleClass =
    'absolute z-[60] bg-primary/40 hover:bg-primary/70 transition-colors'

  return (
    <div
      className="fixed z-[200] flex flex-col rounded-xl border border-primary/40 shadow-2xl shadow-primary/20 overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}>
      <div
        className="h-9 shrink-0 flex items-center gap-2 px-3 bg-card/95 backdrop-blur-md border-b border-border cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}>
        <span className="font-mono text-xs font-bold text-primary tracking-tight">Sheet</span>
        <span className="text-[10px] font-mono text-muted-foreground/70">
          {Math.round(size.width)}×{Math.round(size.height)}
        </span>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto"
              title="Sheet background color">
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 z-[300]" align="end">
            <div className="grid grid-cols-5 gap-1.5 max-w-[200px]">
              {SHEET_BG_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => handleBgPick(c.value)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: bgColor === c.value ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onClose}
          title="Close Sheet">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 relative">
        <Whiteboard
          onClose={onClose}
          height={0}
          onHeightChange={() => {}}
          backgroundColor={bgColor}
          floating
          minimal
          defaultColor="#ef4444"
        />
      </div>

      <div
        className={`${resizeHandleClass} bottom-0 left-2 right-3 h-1.5 cursor-ns-resize`}
        onPointerDown={startResize('s')}
      />
      <div
        className={`${resizeHandleClass} right-0 top-9 bottom-3 w-1.5 cursor-ew-resize`}
        onPointerDown={startResize('e')}
      />
      <div
        className={`${resizeHandleClass} bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize rounded-bl-md border border-background`}
        onPointerDown={startResize('se')}
      />
    </div>
  )
}

export default Sheet