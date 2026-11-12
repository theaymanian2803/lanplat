import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Navbar from './Navbar'

const SIDEBAR_COLLAPSED_KEY = 'lingovault_sidebar_collapsed'

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar onOpenSettings={vi.fn()} onSignOut={vi.fn()} />
    </MemoryRouter>
  )
}

describe('sidebar collapse', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts expanded and collapses the navigation to an icon rail', () => {
    renderNavbar()

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1')
  })

  it('links straight to the lessons library', () => {
    renderNavbar()

    expect(screen.getByRole('link', { name: 'Lessons library' })).toHaveAttribute(
      'href',
      '/lessons'
    )
  })

  it('offers Ask AI in both the sidebar and the mobile header', () => {
    renderNavbar()

    expect(screen.getAllByRole('button', { name: 'Ask AI' })).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(screen.getAllByRole('button', { name: 'Ask AI' }).length).toBeGreaterThan(0)
  })

  it('restores a collapsed sidebar and expands it again', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1')
    renderNavbar()

    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull()
  })
})
