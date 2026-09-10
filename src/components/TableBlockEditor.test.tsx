import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import TableBlockEditor from '@/components/TableBlockEditor'

type EditorState = { headers: string[]; rows: string[][] }

const renderEditor = (initial: EditorState = { headers: [], rows: [] }) => {
  let state: EditorState = {
    headers: [...initial.headers],
    rows: initial.rows.map((r) => [...r]),
  }
  const api: { view: ReturnType<typeof render> | null } = { view: null }

  const props = () => ({
    headers: state.headers,
    rows: state.rows,
    onChange: (h: string[], r: string[][]) => {
      state = { headers: h, rows: r }
      api.view!.rerender(<TableBlockEditor {...props()} />)
    },
  })

  api.view = render(<TableBlockEditor {...props()} />)

  return { view: api.view, getState: () => state }
}

describe('TableBlockEditor', () => {
  it('adds a column and updates its header', () => {
    const { view, getState } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /add column/i }))
    const headerInput = view.container.querySelector('input')
    expect(headerInput).toBeTruthy()
    fireEvent.change(headerInput!, { target: { value: 'Present' } })
    expect(getState().headers).toEqual(['Present'])
  })

  it('adds a row with one input per column and edits cells', () => {
    const { view, getState } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /add column/i }))
    fireEvent.click(screen.getByRole('button', { name: /add row/i }))
    const inputs = view.container.querySelectorAll('input')
    fireEvent.change(inputs[1], { target: { value: 'spiser' } })
    expect(getState().rows).toEqual([['spiser']])
  })

  it('removes a column and its cells from every row', () => {
    const { view, getState } = renderEditor({ headers: ['A', 'B'], rows: [['a', 'b']] })
    const removeButtons = view.container.querySelectorAll('button[title="Remove column"]')
    fireEvent.click(removeButtons[0])
    expect(getState()).toEqual({ headers: ['B'], rows: [['b']] })
  })

  it('removes a row', () => {
    const { view, getState } = renderEditor({ headers: ['A'], rows: [['a'], ['b']] })
    const removeButtons = view.container.querySelectorAll('button[title="Remove row"]')
    fireEvent.click(removeButtons[0])
    expect(getState().rows).toEqual([['b']])
  })

  it('imports JSON as an array of objects, replacing the whole table', () => {
    const { getState } = renderEditor({ headers: ['Old'], rows: [['old']] })
    fireEvent.click(screen.getByRole('button', { name: /import json/i }))
    const textarea = screen.getByPlaceholderText(/\[.*\]/s)
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify([
          { Verb: 'at spise', Present: 'spiser' },
          { Verb: 'at drikke', Present: 'drikker', Past: 'drakk' },
        ]),
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(getState()).toEqual({
      headers: ['Verb', 'Present', 'Past'],
      rows: [
        ['at spise', 'spiser', ''],
        ['at drikke', 'drikker', 'drakk'],
      ],
    })
  })

  it('shows an error for invalid JSON and leaves the table untouched', () => {
    const { getState } = renderEditor({ headers: ['A'], rows: [['a']] })
    fireEvent.click(screen.getByRole('button', { name: /import json/i }))
    fireEvent.change(screen.getByPlaceholderText(/\[.*\]/s), { target: { value: 'not json' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByText(/invalid json/i)).toBeTruthy()
    expect(getState()).toEqual({ headers: ['A'], rows: [['a']] })
  })

  it('copies the table to the clipboard as JSON', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const { getState } = renderEditor({
      headers: ['Verb', 'Past'],
      rows: [['at spise', '']],
    })
    fireEvent.click(screen.getByRole('button', { name: /copy as json/i }))
    await act(async () => {})
    expect(writeText).toHaveBeenCalled()
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual([{ Verb: 'at spise' }])
    expect(getState()).toEqual({ headers: ['Verb', 'Past'], rows: [['at spise', '']] })
  })
})
