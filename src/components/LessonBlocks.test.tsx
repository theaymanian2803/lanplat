import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import LessonBlocks from '@/components/LessonBlocks'
import { createBlock, createTableBlock } from '@/lib/lessonBlocks'

describe('LessonBlocks', () => {
  it('renders a table block as an HTML table with headers and cells', () => {
    const table = createTableBlock(['Infinitiv', 'Præsens', 'Futur'], [['at spise', 'spiser', 'vil spise']])
    render(<LessonBlocks blocks={[table]} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Præsens' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'spiser' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'vil spise' })).toBeInTheDocument()
  })

  it('skips a table block without table data', () => {
    render(<LessonBlocks blocks={[{ id: '1', type: 'table', text: '', color: 'inherit' }]} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('still renders regular blocks', () => {
    render(<LessonBlocks blocks={[createBlock('h1', 'Verbs')]} />)
    expect(screen.getByRole('heading', { name: 'Verbs' })).toBeInTheDocument()
  })
})