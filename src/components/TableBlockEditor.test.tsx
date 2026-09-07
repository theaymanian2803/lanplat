import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
})
