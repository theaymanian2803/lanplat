import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import Landing from './Landing'
import { videosDb } from '@/integrations/turso/db'
import type { Video } from '@/integrations/turso/types'
import { landingLanguages } from '@/landing/languages'
import { landingModules } from '@/landing/modules'

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { list: vi.fn(), add: vi.fn() },
  videosDb: {
    list: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

const makeVideo = (overrides: Partial<Video> & { id: string }): Video => ({
  user_id: 'local',
  media_type: 'video',
  youtube_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  content: null,
  title: 'Untitled',
  language: 'Danish',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const FRENCH_VIDEOS: Video[] = [
  makeVideo({ id: 'f1', title: 'French street talk', language: 'French' }),
  makeVideo({ id: 'f2', title: 'French café scenes', language: 'French' }),
  makeVideo({ id: 'f3', title: 'French news roundup', language: 'French' }),
  makeVideo({ id: 'f4', title: 'French extras are cut off', language: 'French' }),
]

const SWEDISH_VIDEOS: Video[] = [
  makeVideo({ id: 's1', title: 'Swedish podcast', language: 'Swedish' }),
]

const SPANISH_TEXT: Video = makeVideo({
  id: 't1',
  title: 'A Spanish passage',
  language: 'Spanish',
  media_type: 'text',
  youtube_url: null,
  content: 'A short text passage.',
})

const renderLanding = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('Landing', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(videosDb.list).mockClear()
    vi.mocked(videosDb.list).mockResolvedValue([])
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

  it('shows one section per language that has videos, by default', async () => {
    vi.mocked(videosDb.list).mockResolvedValue([...FRENCH_VIDEOS, ...SWEDISH_VIDEOS])
    renderLanding()

    await waitFor(() => expect(videosDb.list).toHaveBeenCalled())
    expect(videosDb.list).toHaveBeenCalledWith()

    expect(await screen.findByText('French street talk')).toBeInTheDocument()
    expect(screen.getByText('French café scenes')).toBeInTheDocument()
    expect(screen.getByText('French news roundup')).toBeInTheDocument()
    expect(screen.getByText('Swedish podcast')).toBeInTheDocument()
  })

  it('gives every language with videos its own section heading', async () => {
    vi.mocked(videosDb.list).mockResolvedValue([...FRENCH_VIDEOS, ...SWEDISH_VIDEOS])
    renderLanding()

    expect(await screen.findByRole('heading', { name: 'French' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Swedish' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Danish' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Spanish' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Japanese' })).toBeNull()
  })

  it('caps each language section at three videos', async () => {
    vi.mocked(videosDb.list).mockResolvedValue([...FRENCH_VIDEOS, ...SWEDISH_VIDEOS])
    renderLanding()

    expect(await screen.findByText('French street talk')).toBeInTheDocument()
    expect(screen.queryByText('French extras are cut off')).toBeNull()
  })

  it('keeps text media out of the video sections', async () => {
    vi.mocked(videosDb.list).mockResolvedValue([...FRENCH_VIDEOS, SPANISH_TEXT])
    renderLanding()

    await waitFor(() => expect(videosDb.list).toHaveBeenCalled())
    expect(screen.queryByText('A Spanish passage')).toBeNull()
  })

  it('swaps a clicked thumbnail for the inline player', async () => {
    vi.mocked(videosDb.list).mockResolvedValue([...FRENCH_VIDEOS, ...SWEDISH_VIDEOS])
    renderLanding()

    fireEvent.click(await screen.findByRole('button', { name: 'Play Swedish podcast' }))

    const frame = await screen.findByTitle('Swedish podcast')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1&autoplay=1'
    )
  })

  it('hides the video sections while the vault has no videos', async () => {
    renderLanding()

    await waitFor(() => expect(videosDb.list).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'French' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Swedish' })).toBeNull()
    expect(screen.queryByText(/Watch the vault/)).toBeNull()
  })
})