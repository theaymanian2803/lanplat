import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Index from '@/pages/Index'
import { languagesDb, videosDb } from '@/integrations/turso/db'

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: {
    list: vi.fn().mockResolvedValue(['Danish', 'Japanese']),
    add: vi.fn().mockResolvedValue(undefined),
  },
  videosDb: {
    list: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

const URL_UNDER_TEST = 'https://youtube.com/watch?v=dQw4w9WgXcQ'

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Index />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

function pickLanguage(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Language' }))
  fireEvent.click(screen.getByRole('option', { name }))
}

function addNewLanguage(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Language' }))
  fireEvent.click(screen.getByRole('option', { name: '+ Add new language' }))
  fireEvent.change(screen.getByPlaceholderText('e.g. Icelandic'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

async function openAddVideoDialog() {
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
  fireEvent.click(await screen.findByRole('button', { name: 'Add Video' }))
}

function fillVideoFields() {
  fireEvent.change(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), {
    target: { value: URL_UNDER_TEST },
  })
  fireEvent.change(screen.getByPlaceholderText('Video title'), { target: { value: 'A title' } })
}

describe('dashboard add video', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists every language in the dropdown along with the option to add one', async () => {
    renderDashboard()
    await openAddVideoDialog()

    fireEvent.click(screen.getByRole('combobox', { name: 'Language' }))

    expect(screen.getAllByRole('option').map((o) => o.textContent?.trim())).toEqual([
      'Danish',
      'Japanese',
      '+ Add new language',
    ])
  })

  it('refuses to save until a language has been chosen', async () => {
    renderDashboard()
    await openAddVideoDialog()
    fillVideoFields()

    expect(screen.getByRole('button', { name: 'Add Video' })).toBeDisabled()
  })

  it('saves the video against a language chosen from the dropdown', async () => {
    renderDashboard()
    await openAddVideoDialog()
    fillVideoFields()
    pickLanguage('Japanese')
    fireEvent.click(screen.getByRole('button', { name: 'Add Video' }))

    await waitFor(() =>
      expect(videosDb.insert).toHaveBeenCalledWith({
        media_type: 'video',
        youtube_url: URL_UNDER_TEST,
        title: 'A title',
        language: 'Japanese',
        content: null,
      }),
    )
  })

  it('creates a language added through the add video form and uses it for the video', async () => {
    renderDashboard()
    await openAddVideoDialog()
    fillVideoFields()
    addNewLanguage('Icelandic')

    await waitFor(() => expect(languagesDb.add).toHaveBeenCalledWith('Icelandic'))

    fireEvent.click(screen.getByRole('button', { name: 'Add Video' }))

    await waitFor(() =>
      expect(videosDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'Icelandic' }),
      ),
    )
  })

  it('creates a language added through the add text form too', async () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add Text' }))

    fireEvent.change(screen.getByPlaceholderText('e.g. Chapter 1 — The Journey'), {
      target: { value: 'A title' },
    })
    fireEvent.change(screen.getByPlaceholderText('Paste the full text here…'), {
      target: { value: 'Some text' },
    })
    addNewLanguage('Icelandic')

    await waitFor(() => expect(languagesDb.add).toHaveBeenCalledWith('Icelandic'))

    fireEvent.click(screen.getByRole('button', { name: 'Add Text' }))

    await waitFor(() =>
      expect(videosDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ media_type: 'text', language: 'Icelandic' }),
      ),
    )
  })
})
