import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import TableBlock from '@/components/TableBlock'
import type { TableData } from '@/integrations/turso/types'

const table: TableData = {
  headers: ['Verb', 'Present', 'Past'],
  rows: [
    ['at spise', 'spiser', 'spiste'],
    ['at drikke', 'drikker', 'drakk'],
  ],
}

describe('TableBlock', () => {
  it('renders the table with headers and cells', () => {
    render(<TableBlock table={table} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Present' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'spiser' })).toBeInTheDocument()
  })

  it('renders nothing for an empty table', () => {
    const { container } = render(<TableBlock table={{ headers: [], rows: [] }} />)
    expect(container.firstChild).toBeNull()
  })

  it('limits the inline table to previewRows but shows every row in the dialog', async () => {
    render(<TableBlock table={table} previewRows={1} />)
    expect(screen.getByRole('cell', { name: 'at spise' })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'at drikke' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /expand table/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('cell', { name: 'at drikke' })).toBeInTheDocument()
  })

  it('opens a full-size dialog with the table on expand', async () => {
    render(<TableBlock table={table} />)
    fireEvent.click(screen.getByRole('button', { name: /expand table/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('columnheader', { name: 'Past' })).toBeInTheDocument()
    expect(within(dialog).getByRole('cell', { name: 'drakk' })).toBeInTheDocument()
  })

  it('closes the dialog', async () => {
    render(<TableBlock table={table} />)
    fireEvent.click(screen.getByRole('button', { name: /expand table/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})