import { createClient } from '@libsql/client/web'
import { getTursoConfig } from '@/lib/tursoConfig'

let cachedClient: ReturnType<typeof createClient> | null = null

export function getTursoClient() {
  if (!cachedClient) {
    const cfg = getTursoConfig()
    cachedClient = createClient({ url: cfg.url, authToken: cfg.token })
  }
  return cachedClient
}

export function resetTursoClient(): void {
  cachedClient = null
}

export async function testTursoConnection(
  url: string,
  token: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const probe = createClient({ url: url.trim(), authToken: token.trim() })
    await probe.execute('SELECT 1')
    return { ok: true, message: 'Connected' }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Connection failed',
    }
  }
}
