import type { ContentBlock } from '@/integrations/turso/types'
import { blockClass, blockStyle } from '@/lib/lessonBlocks'
import { cn } from '@/lib/utils'
import TableBlock from '@/components/TableBlock'

interface LessonBlocksProps {
  blocks: ContentBlock[]
  className?: string
}

const LessonBlocks = ({ blocks, className }: LessonBlocksProps) => (
  <div className={cn('space-y-3', className)}>
    {blocks.map((block) => {
      if (block.type === 'table') {
        if (!block.table) return null
        return <TableBlock key={block.id} table={block.table} />
      }
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