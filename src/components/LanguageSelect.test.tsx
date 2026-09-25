import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LanguageSelect from '@/components/LanguageSelect'
import { languagesDb } from '@/integrations/turso/db'

vi.mock('@/integrations/turso/db', () => ({
  languagesDb: { add: vi.fn().mockResolvedValue(undefined) },
}))

const LANGUAGES = ['Danish', 'Japanese', 'Korean']

function renderSelect(value = '') {
  const onChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <LanguageSelect languages={LANGUAGES} value={value} onChange={onChange} />
    </QueryClientProvider>
  )
  return { onChange }
}

function openMenu() {
  fireEvent.click(screen.getByRole('combobox'))
}

/** Every language plus the escape hatch, as listed in the menu. */
function listedOptions(): string[] {
  return screen.getAllByRole('option').map((o) => o.textContent?.trim() ?? '')
}

describe('LanguageSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists every language that already exists', () => {
    renderSelect()

    openMenu()

    expect(listedOptions()).toEqual([...LANGUAGES, '+ Add new language'])
  })

  it('asks for a choice when nothing is selected yet', () => {
    renderSelect('')

    expect(screen.getByRole('combobox')).toHaveTextContent('Select a language')
  })

  it('shows the language that is currently selected', () => {
    renderSelect('Japanese')

    expect(screen.getByRole('combobox')).toHaveTextContent('Japanese')
  })

  it('reports the language that was picked from the menu', () => {
    const { onChange } = renderSelect()

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: 'Korean' }))

    expect(onChange).toHaveBeenCalledWith('Korean')
    expect(languagesDb.add).not.toHaveBeenCalled()
  })

  it('opens a text field when add new language is picked', () => {
    renderSelect()

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: '+ Add new language' }))

    expect(screen.getByPlaceholderText('e.g. Icelandic')).toBeInTheDocument()
  })

  it('creates a language that does not exist yet and selects it', async () => {
    const { onChange } = renderSelect()

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: '+ Add new language' }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Icelandic'), {
      target: { value: '  Icelandic  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(languagesDb.add).toHaveBeenCalledWith('Icelandic'))
    expect(onChange).toHaveBeenCalledWith('Icelandic')
  })

  it('selects the existing language instead of creating a near-duplicate', async () => {
    const { onChange } = renderSelect()

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: '+ Add new language' }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Icelandic'), {
      target: { value: 'danish' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('Danish'))
    expect(languagesDb.add).not.toHaveBeenCalled()
  })

  it('will not create a language from a blank name', () => {
    renderSelect()

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: '+ Add new language' }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Icelandic'), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('goes back to the menu when the text field is cancelled', () => {
    const { onChange } = renderSelect()

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: '+ Add new language' }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Icelandic'), {
      target: { value: 'Icelandic' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByPlaceholderText('e.g. Icelandic')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(languagesDb.add).not.toHaveBeenCalled()
  })
})
