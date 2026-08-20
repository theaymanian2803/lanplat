import type { ContentBlock } from '@/integrations/turso/types'
import { blockClass, blockStyle } from '@/lib/lessonBlocks'
import { cn } from '@/lib/utils'

interface LessonBlocksProps {
  blocks: ContentBlock[]
  className?: string
}

const LessonBlocks = ({ blocks, className }: LessonBlocksProps) => (
  <div className={cn('space-y-3', className)}>
    {blocks.map((block) => {
      const Tag = block.type as keyof JSX.IntrinsicElements
      return (
        <Tag key={block.id} className={blockClass(block.type)} style={blockStyle(block.color)}>
          {block.text}
        </Tag>
      )
    })}
  </div>
)

export default LessonBlocks