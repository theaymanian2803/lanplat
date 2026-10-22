import { fetchTranscript } from './_transcript'

export const maxDuration = 60

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url, 'https://languageplatform.unccode.site')
    const videoId = url.searchParams.get('videoId') ?? ''
    const lang = url.searchParams.get('lang') ?? ''

    const result = await fetchTranscript(videoId, lang)

    if (!result.ok) {
      return Response.json(
        { error: result.error, reason: result.reason },
        { status: result.status }
      )
    }

    return Response.json(result.data, {
      status: 200,
      headers: {
        'Cache-Control':
          'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  },
}
