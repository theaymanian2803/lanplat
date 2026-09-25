import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import App from './App'
import { landingModules } from '@/landing/modules'

vi.mock('@/integrations/turso/db', () => ({
  ensureSchema: vi.fn().mockResolvedValue(undefined),
  flushSrsQueue: vi.fn(),
  videosDb: { list: vi.fn().mockResolvedValue([]), insert: vi.fn(), remove: vi.fn() },
  vocabularyDb: { list: vi.fn().mockResolvedValue([]) },
  languagesDb: { list: vi.fn().mockResolvedValue(['Danish']) },
  lessonsDb: { list: vi.fn().mockResolvedValue([]) },
  notesDb: { listByVideo: vi.fn().mockResolvedValue([]) },
  screenshotsDb: { listByVideo: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toasts: [], toast: vi.fn(), dismiss: vi.fn() }),
}))

/** Renders the whole app at a real browser path, since App owns a BrowserRouter. */
function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

const codeField = () => screen.getByPlaceholderText('Access code')
const codeForm = () => codeField().closest('form') as HTMLFormElement

describe('App routing', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    // The onboarding tour force-navigates to /dashboard when open. Mark it done so these
    // tests exercise routing rather than the tour.
    localStorage.setItem('lingovault_onboarded', '1')
  })

  it('shows the landing page to an anonymous visitor', async () => {
    renderAt('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: /actually learn/i })
    ).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Access code')).toBeNull()
  })

  it('asks for the code on a deep link into the app', async () => {
    renderAt('/vocab')

    expect(await screen.findByPlaceholderText('Access code')).toBeInTheDocument()
  })

  it('asks for the code on every gated route', async () => {
    for (const path of ['/dashboard', '/quiz', '/lessons', '/languages', '/video/abc']) {
      const view = renderAt(path)
      expect(await screen.findByPlaceholderText('Access code')).toBeInTheDocument()
      view.unmount()
    }
  })

  it('lands the visitor on the route they asked for once unlocked', async () => {
    renderAt('/vocab')

    fireEvent.change(await screen.findByPlaceholderText('Access code'), {
      target: { value: '123123123' },
    })
    fireEvent.submit(codeForm())

    expect(await screen.findByRole('heading', { name: 'Vocab Bank' })).toBeInTheDocument()
  })

  it('serves the dashboard from /dashboard, not from the root', async () => {
    sessionStorage.setItem('lingovault_unlocked', '1')
    renderAt('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('never serves the dashboard at the root', async () => {
    sessionStorage.setItem('lingovault_unlocked', '1')
    renderAt('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: /actually learn/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull()
  })

  it('keeps every module card pointing at a real in-app route', async () => {
    renderAt('/')

    for (const module of landingModules) {
      // The footer repeats every module as a text link, so both copies are checked.
      const links = await screen.findAllByRole('link', { name: new RegExp(module.title, 'i') })
      for (const link of links) {
        expect(link).toHaveAttribute('href', module.to)
      }
    }
  })

  // The card href assertion above only checks the manifest against itself: a card can point
  // at a route the router does not define and every other test still passes. This one asks
  // the real router. A `to` with no matching route falls through to `*`, which renders the
  // 404 page and therefore no navbar, so the `findByRole` never resolves.
  it('routes every landing module link to a page the router actually defines', async () => {
    sessionStorage.setItem('lingovault_unlocked', '1')

    for (const { to } of landingModules) {
      const view = renderAt(to)
      expect(await screen.findByRole('navigation')).toBeInTheDocument()
      expect(screen.queryByText('Oops! Page not found')).toBeNull()
      view.unmount()
    }
  })
})
