import { beforeEach, describe, expect, it, vi } from 'vitest'
import { languagesDb } from '@/integrations/turso/db'

const { execute, batch } = vi.hoisted(() => ({
  execute: vi.fn(),
  batch: vi.fn(),
}))

vi.mock('@/integrations/turso/client', () => ({
  getTursoClient: () => ({ execute, batch }),
}))

/** Rows the fake SELECT will hand back for the duplicate check. */
let existingRows: { name: string }[] = []

/** The name argument of every INSERT the code under test actually sent. */
function insertedNames(): string[] {
  return execute.mock.calls
    .map(([arg]) => arg)
    .filter((arg): arg is { sql: string; args: unknown[] } => typeof arg === 'object' && arg !== null)
    .filter((arg) => arg.sql.startsWith('INSERT'))
    .map((arg) => String(arg.args[0]))
}

describe('languagesDb.add', () => {
  beforeEach(() => {
    execute.mockReset()
    batch.mockReset()
    existingRows = []
    execute.mockImplementation((arg: unknown) => {
      if (typeof arg === 'string') return Promise.resolve({ rows: existingRows })
      return Promise.resolve({ rows: [] })
    })
  })

  it('stores the trimmed name so surrounding spaces never reach the database', async () => {
    await languagesDb.add('  Korean  ')

    expect(insertedNames()).toEqual(['Korean'])
  })

  it('rejects a blank name without writing a row', async () => {
    await expect(languagesDb.add('   ')).rejects.toThrow('Language name is required')

    expect(insertedNames()).toEqual([])
  })

  it('rejects a name that differs from an existing one only by case', async () => {
    existingRows = [{ name: 'Danish' }]

    await expect(languagesDb.add('danish')).rejects.toThrow('That language already exists')

    expect(insertedNames()).toEqual([])
  })

  it('rejects a name that already exists in exactly the same case', async () => {
    existingRows = [{ name: 'Danish' }]

    await expect(languagesDb.add('Danish')).rejects.toThrow('That language already exists')

    expect(insertedNames()).toEqual([])
  })

  it('writes a genuinely new name alongside the existing ones', async () => {
    existingRows = [{ name: 'Danish' }, { name: 'Japanese' }]

    await languagesDb.add('Korean')

    expect(insertedNames()).toEqual(['Korean'])
  })
})
