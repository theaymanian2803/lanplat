import { afterEach, describe, expect, it, vi } from 'vitest'

import { askTutor } from '@/lib/aiChat'

const jsonResponse = (value: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => value,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('askTutor', () => {
  it('posts the conversation and context, then returns the reply', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ reply: '  Bonjour means hello.  ' }))
    vi.stubGlobal('fetch', fetchFn)

    const reply = await askTutor(
      [{ role: 'user', content: 'What does bonjour mean?' }],
      { word: 'bonjour', language: 'French', answerLanguage: 'Arabic' }
    )

    expect(reply).toBe('Bonjour means hello.')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/chat')
    expect(JSON.parse(init.body)).toEqual({
      messages: [{ role: 'user', content: 'What does bonjour mean?' }],
      word: 'bonjour',
      language: 'French',
      answerLanguage: 'Arabic',
    })
  })

  it('keeps only the last ten turns', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ reply: 'ok' }))
    vi.stubGlobal('fetch', fetchFn)

    const messages = Array.from({ length: 14 }, (_, i) => ({
      role: 'user' as const,
      content: `message ${i}`,
    }))
    await askTutor(messages)

    const body = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(body.messages).toHaveLength(10)
    expect(body.messages[0].content).toBe('message 4')
  })

  it('throws the server error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'AI chat is not configured.' }, false, 503))
    )

    await expect(askTutor([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'AI chat is not configured.'
    )
  })

  it('throws when the reply is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ reply: '   ' })))

    await expect(askTutor([{ role: 'user', content: 'hi' }])).rejects.toThrow('empty reply')
  })
})
