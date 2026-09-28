import { afterEach, describe, expect, it, vi } from 'vitest'

import functionModule from './book-text'

const handler = functionModule.fetch

const call = (path: string) =>
  handler(
    new Request(
      `https://languageplatform.unccode.site/api/book-text?path=${encodeURIComponent(path)}`
    )
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('book-text function', () => {
  it('rejects a disallowed path', async () => {
    const res = await call('/etc/passwd')
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Disallowed path' })
  })

  it('proxies an allowed path and returns the book text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'Bonjour le monde' })
    )

    const res = await call('/cache/epub/62215/pg62215.txt')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    await expect(res.text()).resolves.toBe('Bonjour le monde')
  })

  it('returns 502 when the upstream fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const res = await call('/cache/epub/62215/pg62215.txt')
    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({ error: 'Upstream failed: 500' })
  })

  it('returns 502 with a timeout message when the upstream aborts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
    )

    const res = await call('/cache/epub/62215/pg62215.txt')
    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({ error: 'Upstream failed: timeout' })
  })
})