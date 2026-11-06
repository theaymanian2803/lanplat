import { describe, expect, it, vi } from 'vitest'

import { buildSystemPrompt, chatWithTutor, parseTutorRequest } from '../../api/chat'

const turn = (role: 'user' | 'assistant', content: string) => ({ role, content })

describe('parseTutorRequest', () => {
  it('accepts a valid payload', () => {
    const parsed = parseTutorRequest({
      messages: [turn('user', 'What does bonjour mean?')],
      word: 'bonjour',
      language: 'French',
      answerLanguage: 'Arabic',
      note: 'chapter 1',
      transcript: 'Bonjour, dit-il.',
      title: 'Le Petit Prince',
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.messages).toHaveLength(1)
    expect(parsed?.word).toBe('bonjour')
    expect(parsed?.answerLanguage).toBe('Arabic')
  })

  it('rejects malformed, empty, or oversized conversations', () => {
    expect(parseTutorRequest(null)).toBeNull()
    expect(parseTutorRequest({ messages: [] })).toBeNull()
    expect(parseTutorRequest({ messages: [{ role: 'system', content: 'hi' }] })).toBeNull()
    expect(parseTutorRequest({ messages: [turn('user', '   ')] })).toBeNull()
    expect(parseTutorRequest({ messages: [turn('user', 'x'.repeat(4001))] })).toBeNull()
    expect(
      parseTutorRequest({
        messages: Array.from({ length: 13 }, () => turn('user', 'hello')),
      })
    ).toBeNull()
  })
})

describe('buildSystemPrompt', () => {
  it('includes the answer language, focus word, and material', () => {
    const prompt = buildSystemPrompt({
      messages: [turn('user', 'explain')],
      word: 'bonjour',
      language: 'French',
      answerLanguage: 'Arabic',
      title: 'Le Petit Prince',
      transcript: 'Bonjour, dit-il.',
    })

    expect(prompt).toContain('Answer in Arabic.')
    expect(prompt).toContain('studying French')
    expect(prompt).toContain('"bonjour"')
    expect(prompt).toContain('Le Petit Prince')
    expect(prompt).toContain('Bonjour, dit-il.')
  })
})

describe('chatWithTutor', () => {
  it('reports when the key is missing', async () => {
    const result = await chatWithTutor(
      { messages: [turn('user', 'hi')] },
      { apiKey: '' }
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(503)
      expect(result.error).toContain('not configured')
    }
  })

  it('calls OpenRouter with the chosen model and returns the reply', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'Bonjour means hello.' } }] }),
    })

    const result = await chatWithTutor(
      {
        messages: [turn('user', 'What does bonjour mean?')],
        word: 'bonjour',
        language: 'French',
        answerLanguage: 'Arabic',
      },
      { apiKey: 'test-key', model: 'deepseek/deepseek-v3.2', fetchImpl }
    )

    expect(result).toEqual({ ok: true, reply: 'Bonjour means hello.' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('deepseek/deepseek-v3.2')
    expect(body.max_tokens).toBe(700)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toContain('Answer in Arabic.')
    expect(body.messages[1]).toEqual({ role: 'user', content: 'What does bonjour mean?' })
  })

  it('maps a rate limit to a friendly error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'rate limited' } }),
    })

    const result = await chatWithTutor(
      { messages: [turn('user', 'hi')] },
      { apiKey: 'test-key', fetchImpl }
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(429)
      expect(result.error).toContain('busy')
    }
  })

  it('rejects an empty reply', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '   ' } }] }),
    })

    const result = await chatWithTutor(
      { messages: [turn('user', 'hi')] },
      { apiKey: 'test-key', fetchImpl }
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('empty reply')
  })
})
