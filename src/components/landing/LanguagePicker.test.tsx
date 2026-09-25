import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { LanguagePicker } from './LanguagePicker'
import { landingLanguages } from '@/landing/languages'

describe('LanguagePicker', () => {
  it('offers a toggle for every language', () => {
    render(<LanguagePicker value={null} onChange={vi.fn()} />)

    for (const language of landingLanguages) {
      expect(screen.getByRole('button', { name: language.name })).toBeInTheDocument()
    }
  })

  it('marks the current choice as pressed', () => {
    render(<LanguagePicker value="Danish" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Danish' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Spanish' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('presets nothing when the visitor has not chosen', () => {
    render(<LanguagePicker value={null} onChange={vi.fn()} />)

    for (const language of landingLanguages) {
      expect(screen.getByRole('button', { name: language.name })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    }
  })

  it('reports the language that was picked, by database name', () => {
    const onChange = vi.fn()
    render(<LanguagePicker value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Japanese' }))

    expect(onChange).toHaveBeenCalledWith('Japanese')
  })

  it('is a labelled group for screen readers', () => {
    render(<LanguagePicker value={null} onChange={vi.fn()} />)

    expect(screen.getByRole('group', { name: /choose a language/i })).toBeInTheDocument()
  })
})
