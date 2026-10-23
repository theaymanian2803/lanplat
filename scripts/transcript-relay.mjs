import http from 'node:http'

import { fetchTranscript } from '../api/transcript.ts'

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'
const token = process.env.TRANSCRIPT_RELAY_TOKEN

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (url.pathname !== '/transcript') {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Not found', reason: 'upstream' }))
    return
  }

  if (token && url.searchParams.get('token') !== token) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Unauthorized', reason: 'upstream' }))
    return
  }

  try {
    const result = await fetchTranscript(
      url.searchParams.get('videoId') ?? '',
      url.searchParams.get('lang') ?? '',
    )
    res.writeHead(result.ok ? 200 : result.status, {
      'Content-Type': 'application/json; charset=utf-8',
    })
    res.end(
      JSON.stringify(result.ok ? result.data : { error: result.error, reason: result.reason }),
    )
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Transcript relay failed', reason: 'upstream' }))
  }
})

server.listen(port, host, () => {
  console.log(`Transcript relay listening on http://${host}:${port}/transcript`)
})
