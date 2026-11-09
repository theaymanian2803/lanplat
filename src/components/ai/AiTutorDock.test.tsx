import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import AiTutorDock from '@/components/ai/AiTutorDock'
import { resetAiTutor, useRegisterAiTutor } from '@/lib/aiTutor'
import type { TutorContext } from '@/lib/aiChat'

vi.mock('@/lib/aiChat', () => ({
  askTutor: vi.fn().mockResolvedValue('An answer.'),
}))

function Registrar({ context }: { context: TutorContext }) {
  useRegisterAiTutor({ context })
  return null
}

function renderDock(path = '/', context?: TutorContext) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AiTutorDock />
      {context ? <Registrar context={context} /> : null}
    </MemoryRouter>
  )
}

describe('AiTutorDock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAiTutor()
  })

  it('renders a floating Ask AI bubble without an open chat', () => {
    renderDock('/')

    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a chat card that is labelled with the landing page route', () => {
    renderDock('/')

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))

    expect(screen.getByRole('dialog', { name: 'Ask AI' })).toBeInTheDocument()
    expect(screen.getByText(/About Landing page/)).toBeInTheDocument()
    expect(screen.getByLabelText('Message the AI tutor')).toBeInTheDocument()
  })

  it('labels the chat with the app route when nothing else is registered', () => {
    renderDock('/vocab')

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))

    expect(screen.getByText(/About Vocabulary Bank/)).toBeInTheDocument()
  })

  it('prefers registered page context over the route label', () => {
    renderDock('/video/abc', { title: 'Danish news', language: 'Danish' })

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))

    expect(screen.getByText(/About Danish news/)).toBeInTheDocument()
    expect(screen.queryByText(/Study Room/)).not.toBeInTheDocument()
  })

  it('closes the chat from its close button', () => {
    renderDock('/')

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeInTheDocument()
  })

  it('closes the chat with Escape', () => {
    renderDock('/')

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
