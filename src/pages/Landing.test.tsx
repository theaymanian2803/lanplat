import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Landing from './Landing'
import { landingLanguages } from '@/landing/languages'
import { landingModules } from '@/landing/modules'

const renderLanding = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  )

const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('Landing', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('leads with a single headline and one clear way in', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    // The navbar and the hero both offer the way in, and each one leads to the vault.
    for (const link of screen.getAllByRole('link', { name: /enter the vault/i })) {
      expect(link).toHaveAttribute('href', '/dashboard')
    }
  })

  it('lists every module as a way into the app', () => {
    renderLanding()

    for (const module of landingModules) {
      // The hub card and the footer link are the same way in, so both carry the route.
      for (const link of screen.getAllByRole('link', { name: new RegExp(module.title, 'i') })) {
        expect(link).toHaveAttribute('href', module.to)
      }
    }
  })

  it('offers every language before anything is chosen', () => {
    renderLanding()

    for (const language of landingLanguages) {
      expect(screen.getByRole('button', { name: language.name })).toBeInTheDocument()
    }
  })

  it('remembers the language so the app can open on it', () => {
    renderLanding()

    pick('Spanish')

    expect(localStorage.getItem('lingovault_target_language')).toBe('Spanish')
    expect(screen.getByRole('button', { name: 'Spanish' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reveals the chosen language detail only after a choice is made', () => {
    renderLanding()

    expect(screen.queryByText(new RegExp(landingLanguages[0].tagline))).toBeNull()

    pick('Danish')

    expect(screen.getByText(new RegExp(landingLanguages[0].tagline))).toBeInTheDocument()
    expect(screen.getByText('Words banked')).toBeInTheDocument()
    for (const highlight of landingLanguages[0].highlights) {
      expect(screen.getByText(highlight)).toBeInTheDocument()
    }
  })

  it('badges every module card with the chosen language', () => {
    renderLanding()

    pick('Danish')

    // The picker button, the hero badge, and one badge per card.
    expect(screen.getAllByText('Danish')).toHaveLength(landingModules.length + 2)
  })

  it('reopens on the language that was chosen before', () => {
    localStorage.setItem('lingovault_target_language', 'Japanese')
    renderLanding()

    expect(screen.getByRole('button', { name: 'Japanese' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByText(new RegExp(landingLanguages[1].tagline))).toBeInTheDocument()
  })

  it('ignores a stored language the manifest does not know about', () => {
    localStorage.setItem('lingovault_target_language', 'Klingon')
    renderLanding()

    for (const language of landingLanguages) {
      expect(screen.getByRole('button', { name: language.name })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    }
    expect(screen.queryByText(/Klingon/)).toBeNull()
  })

  it('paints its content immediately, with no loading state', () => {
    renderLanding()

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
