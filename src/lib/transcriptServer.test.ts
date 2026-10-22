import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  extractCaptionTracksFromHtml,
  parseJson3,
  parseXmlCues,
  pickTrack,
  summarizeTracks,
} from '../../api/transcript'
import functionModule from '../../api/transcript'

const handler = functionModule.fetch

const call = (query: string) =>
  handler(
    new Request(`https://languageplatform.unccode.site/api/transcript${query}`)
  )

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseJson3', () => {
  it('normalizes events, drops duplicates and appends aAppend segments', () => {
    const cues = parseJson3({
      events: [
        { tStartMs: 0, dDurationMs: 1200, segs: [{ utf8: 'hej ' }, { utf8: 'verden' }] },
        { tStartMs: 1200, dDurationMs: 800, segs: [{ utf8: 'hej verden' }] },
        { tStartMs: 2000, dDurationMs: 500, aAppend: 1, segs: [{ utf8: 'igen' }] },
        { tStartMs: 2500, dDurationMs: 500 },
      ],
    })

    expect(cues).toEqual([
      { start: 0, dur: 2.5, text: 'hej verden igen' },
    ])
  })

  it('returns nothing for malformed input', () => {
    expect(parseJson3(null)).toEqual([])
    expect(parseJson3({ events: 'nope' })).toEqual([])
  })
})

describe('parseXmlCues', () => {
  it('reads srv3 paragraph captions', () => {
    const cues = parseXmlCues(
      '<transcript><body><p t="1200" d="3400"><s>hej</s> <s>verden</s></p>' +
        '<p t="4600" d="1000">igen &amp; farvel</p></body></transcript>'
    )

    expect(cues).toEqual([
      { start: 1.2, dur: 3.4, text: 'hej verden' },
      { start: 4.6, dur: 1, text: 'igen & farvel' },
    ])
  })

  it('reads srv1 text captions', () => {
    const cues = parseXmlCues(
      '<transcript><text start="1.5" dur="2.0">hej &amp; velkommen</text></transcript>'
    )

    expect(cues).toEqual([{ start: 1.5, dur: 2, text: 'hej & velkommen' }])
  })
})

describe('track selection', () => {
  const manualDanish = { baseUrl: 'a', languageCode: 'da', name: 'Danish' }
  const autoDanish = { baseUrl: 'b', languageCode: 'da', kind: 'asr', name: 'Danish (auto)' }
  const autoEnglish = { baseUrl: 'c', languageCode: 'en', kind: 'asr', name: 'English (auto)' }

  it('prefers the requested language, then manual over ASR', () => {
    expect(pickTrack([autoDanish, manualDanish, autoEnglish], 'da')).toBe(manualDanish)
    expect(pickTrack([autoEnglish], 'da')).toBe(autoEnglish)
  })

  it('matches regional variants such as es-419 for es', () => {
    const latinSpanish = { baseUrl: 'd', languageCode: 'es-419', name: 'Spanish (Latin America)' }
    expect(pickTrack([autoEnglish, latinSpanish], 'es')).toBe(latinSpanish)
  })

  it('falls back to any manual track, then the first track', () => {
    expect(pickTrack([autoEnglish, manualDanish], 'fr')).toBe(manualDanish)
    expect(pickTrack([autoEnglish], 'fr')).toBe(autoEnglish)
    expect(pickTrack([], 'da')).toBeNull()
  })

  it('summarizes one entry per language, preferring manual names', () => {
    expect(summarizeTracks([autoDanish, manualDanish, autoEnglish])).toEqual([
      { code: 'da', name: 'Danish', generated: false },
      { code: 'en', name: 'English (auto)', generated: true },
    ])
  })
})

describe('extractCaptionTracksFromHtml', () => {
  it('brace-scans captionTracks out of the watch page', () => {
    const html =
      '<script>var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":' +
      '{"captionTracks":[{"baseUrl":"https:\\/\\/www.youtube.com\\/api\\/timedtext?v=x",' +
      '"languageCode":"da","name":{"simpleText":"Danish"}}]}}};</script>'

    expect(extractCaptionTracksFromHtml(html)).toEqual([
      {
        baseUrl: 'https://www.youtube.com/api/timedtext?v=x',
        languageCode: 'da',
        kind: undefined,
        name: 'Danish',
      },
    ])
  })

  it('returns nothing when the page has no caption tracks', () => {
    expect(extractCaptionTracksFromHtml('<html></html>')).toEqual([])
  })
})

describe('transcript function', () => {
  it('rejects an invalid video id without calling YouTube', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await call('?videoId=short&lang=da')
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Invalid video id',
      reason: 'invalid-id',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns normalized cues for a video with captions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('youtubei/v1/player')) {
          return json({
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl: 'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=da',
                    languageCode: 'da',
                    kind: 'asr',
                    name: { simpleText: 'Danish (auto)' },
                  },
                ],
              },
            },
          })
        }
        if (url.includes('timedtext')) {
          return json({
            events: [
              { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: 'hej verden' }] },
            ],
          })
        }
        return new Response('', { status: 404 })
      })
    )

    const res = await call('?videoId=abcdefghijk&lang=da')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400')
    await expect(res.json()).resolves.toEqual({
      videoId: 'abcdefghijk',
      languageCode: 'da',
      isGenerated: true,
      tracks: [{ code: 'da', name: 'Danish (auto)', generated: true }],
      cues: [{ start: 0, dur: 1.5, text: 'hej verden' }],
    })
  })

  it('returns 404 when neither source exposes captions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('youtubei/v1/player')) return json({})
        if (url.includes('youtube.com/watch')) return new Response('<html></html>')
        return new Response('', { status: 404 })
      })
    )

    const res = await call('?videoId=abcdefghijk&lang=da')
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({
      error: 'No captions for this video',
      reason: 'no-captions',
    })
  })
})
