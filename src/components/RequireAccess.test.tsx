import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RequireAccess from './RequireAccess'

const PRIVATE_PAGE = () => <p>secret dashboard</p>

/** Renders a guarded route so the test can tell the form and the outlet apart. */
function renderGuard(initialEntries: string[] = ['/dashboard']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<RequireAccess />}>
          <Route path="/dashboard" element={<PRIVATE_PAGE />} />
          <Route path="/vocab" element={<p>secret bank</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

const codeField = () => screen.getByPlaceholderText('Access code')
const codeForm = () => codeField().closest('form') as HTMLFormElement

describe('RequireAccess', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('asks for the code when nothing is unlocked', () => {
    renderGuard()

    expect(codeField()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
    expect(screen.queryByText('secret dashboard')).toBeNull()
  })

  it('renders the route the visitor actually asked for once unlocked', () => {
    sessionStorage.setItem('lingovault_unlocked', '1')
    renderGuard(['/vocab'])

    expect(screen.getByText('secret bank')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Access code')).toBeNull()
  })

  it('reveals the page on the correct code without a reload', () => {
    renderGuard()

    fireEvent.change(codeField(), { target: { value: '123123123' } })
    fireEvent.submit(codeForm())

    expect(screen.getByText('secret dashboard')).toBeInTheDocument()
    expect(sessionStorage.getItem('lingovault_unlocked')).toBe('1')
  })

  it('refuses a wrong code and shows why', () => {
    renderGuard()

    fireEvent.change(codeField(), { target: { value: 'nope' } })
    fireEvent.submit(codeForm())

    expect(screen.queryByText('secret dashboard')).toBeNull()
    expect(screen.getByText(/incorrect code/i)).toBeInTheDocument()
    expect(codeField()).toHaveValue('')
  })

  it('will not submit an empty code', () => {
    renderGuard()

    expect(screen.getByRole('button', { name: /unlock/i })).toBeDisabled()
  })
})
