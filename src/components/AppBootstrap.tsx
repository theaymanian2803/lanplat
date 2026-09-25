import { useEffect } from 'react'

import { ensureSchema, flushSrsQueue } from '@/integrations/turso/db'

/**
 * Creates the schema and drains the queued spaced-repetition writes. Mounted only inside
 * the access gate, so a visitor sitting on the public landing page never talks to the
 * database.
 */
const AppBootstrap = () => {
  useEffect(() => {
    ensureSchema().catch((e) => {
      console.error('Failed to initialize database schema:', e)
    })
    flushSrsQueue()
  }, [])

  return null
}

export default AppBootstrap
