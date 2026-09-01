import * as React from 'react'

import { cn } from '@/lib/utils'

export interface AutoGrowTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const AutoGrowTextarea = React.forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  ({ className, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null)

    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement)

    const resize = React.useCallback(() => {
      const el = innerRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }, [])

    React.useEffect(() => {
      resize()
    }, [resize, props.value])

    return (
      <textarea
        ref={innerRef}
        onChange={(e) => {
          resize()
          onChange?.(e)
        }}
        className={cn(
          'flex min-h-9 w-full resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)
AutoGrowTextarea.displayName = 'AutoGrowTextarea'

export { AutoGrowTextarea }