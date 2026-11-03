import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import TutorChat from '@/components/ai/TutorChat'
import { askTutor } from '@/lib/aiChat'

vi.mock('@/lib/aiChat', () => ({
  askTutor: vi.fn(),
}))

describe('TutorChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds an assistant answer to the context through the callback', async () => {
    vi.mocked(askTutor).mockResolvedValue('A long explanation.')
    const onAddToContext = vi.fn()
    render(
      <TutorChat
        context={{ word: 'hund', answerLanguage: 'English' }}
        onAddToContext={onAddToContext}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Explain this word' }))

    expect(await screen.findByText('A long explanation.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add this answer to the context note' }))

    expect(onAddToContext).toHaveBeenCalledWith('A long explanation.')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add this answer to the context note' })
      ).toBeDisabled()
    )
  })

  it('does not render the context action without a callback', async () => {
    vi.mocked(askTutor).mockResolvedValue('A long explanation.')
    render(<TutorChat context={{ word: 'hund', answerLanguage: 'English' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Explain this word' }))
    await screen.findByText('A long explanation.')

    expect(
      screen.queryByRole('button', { name: 'Add this answer to the context note' })
    ).toBeNull()
  })
})
