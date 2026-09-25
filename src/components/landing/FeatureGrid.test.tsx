import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { FeatureGrid } from './FeatureGrid'
import { landingModules } from '@/landing/modules'

const renderGrid = (languageName: string | null = null) =>
  render(
    <MemoryRouter>
      <FeatureGrid languageName={languageName} />
    </MemoryRouter>
  )

describe('FeatureGrid', () => {
  it('offers a card for every module', () => {
    renderGrid()

    for (const module of landingModules) {
      expect(screen.getByRole('link', { name: new RegExp(module.title, 'i') })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('link')).toHaveLength(landingModules.length)
  })

  it('sends each card to the page that backs it up', () => {
    renderGrid()

    for (const module of landingModules) {
      expect(screen.getByRole('link', { name: new RegExp(module.title, 'i') })).toHaveAttribute(
        'href',
        module.to
      )
    }
  })

  it('shows the call to action on every card', () => {
    renderGrid()

    for (const module of landingModules) {
      expect(screen.getByText(module.cta)).toBeInTheDocument()
    }
  })

  it('marks the selected language so the grid reflects the visitor context', () => {
    renderGrid('Japanese')

    expect(screen.getAllByText('Japanese')).toHaveLength(landingModules.length)
  })

  it('leaves the badge off when no language is chosen yet', () => {
    renderGrid()

    expect(screen.queryByText('Japanese')).toBeNull()
  })
})
