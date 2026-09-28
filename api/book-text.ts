export const maxDuration = 60

const UPSTREAM = 'https://www.gutenberg.org'
const ALLOWED_PREFIXES = ['/cache/epub/', '/files/', '/ebooks/']
const UPSTREAM_TIMEOUT_MS = 50000

async function fetchUpstream(path: string): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    return await fetch(`${UPSTREAM}${path}`, { signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return Response.json({ error: 'Disallowed path' }, { status: 400 })
  }

  const upstream = await fetchUpstream(path)

  if (!upstream?.ok) {
    return Response.json(
      { error: `Upstream failed: ${upstream?.status ?? 'timeout'}` },
      { status: 502 }
    )
  }

  const text = await upstream.text()
  return new Response(text, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control':
        'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}