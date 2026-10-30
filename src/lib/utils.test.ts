import { afterEach, describe, expect, it, vi } from 'vitest'

import { newId } from '@/lib/utils'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('newId', () => {
  it('uses crypto.randomUUID when the context has it', () => {
    const randomUUID = vi.fn().mockReturnValue('11111111-1111-4111-8111-111111111111')
    vi.stubGlobal('crypto', { randomUUID })

    expect(newId()).toBe('11111111-1111-4111-8111-111111111111')
    expect(randomUUID).toHaveBeenCalled()
  })

  it('builds a v4 id from getRandomValues outside a secure context', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab)
        return bytes
      },
    })

    const id = newId()

    expect(id).toMatch(UUID)
    // Version 4 and variant bits were forced even though every random byte was 0xab.
    expect(id[14]).toBe('4')
    expect(['8', '9', 'a', 'b']).toContain(id[19])
  })

  it('still returns an id when crypto is unavailable at all', () => {
    vi.stubGlobal('crypto', undefined)

    expect(newId()).toMatch(UUID)
  })
})
