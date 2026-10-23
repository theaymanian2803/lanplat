import { ProxyAgent } from 'undici'

export interface TranscriptCue {
  start: number
  dur: number
  text: string
}

export interface TranscriptTrack {
  code: string
  name: string
  generated: boolean
}

export interface TranscriptPayload {
  videoId: string
  languageCode: string
  isGenerated: boolean
  tracks: TranscriptTrack[]
  cues: TranscriptCue[]
}

interface RawTrack {
  baseUrl?: string
  languageCode?: string
  kind?: string
  name?: string
}

export type TranscriptFailureReason = 'invalid-id' | 'no-captions' | 'upstream' | 'blocked'

export type TranscriptResult =
  | { ok: true; data: TranscriptPayload }
  | { ok: false; status: number; error: string; reason: TranscriptFailureReason }

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const WATCH_URL = 'https://www.youtube.com/watch'
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const ANDROID_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip'
const ANDROID_VERSION = '20.10.38'
const REQUEST_TIMEOUT_MS = 12000
const RELAY_TIMEOUT_MS = 25000
const SUPADATA_URL = 'https://api.supadata.ai/v1/youtube/transcript'
const SUPADATA_TIMEOUT_MS = 20000

export function isVideoId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id)
}

let proxyDispatcher: ProxyAgent | null = null
let proxyKey = ''

function getProxyDispatcher(): ProxyAgent | null {
  const proxyUrl = (process.env.TRANSCRIPT_PROXY_URL ?? '').trim()
  if (!proxyUrl) return null
  if (!proxyDispatcher || proxyKey !== proxyUrl) {
    proxyDispatcher = new ProxyAgent(proxyUrl)
    proxyKey = proxyUrl
  }
  return proxyDispatcher
}

async function request(
  url: string,
  init: RequestInit,
  useProxy = true,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const dispatcher = useProxy ? getProxyDispatcher() : null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const options = dispatcher
      ? ({ ...init, signal: controller.signal, dispatcher } as RequestInit)
      : { ...init, signal: controller.signal }
    return await fetch(url, options)
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFromRelay(
  videoId: string,
  lang: string
): Promise<TranscriptResult | null> {
  const relay = (process.env.TRANSCRIPT_RELAY_URL ?? '').trim()
  if (!relay) return null

  let endpoint: string
  try {
    const url = new URL(relay)
    url.searchParams.set('videoId', videoId)
    url.searchParams.set('lang', lang)
    endpoint = url.toString()
  } catch {
    return {
      ok: false,
      status: 500,
      error: 'Transcript relay is misconfigured',
      reason: 'upstream',
    }
  }

  try {
    const res = await request(
      endpoint,
      { headers: { Accept: 'application/json' } },
      false,
      RELAY_TIMEOUT_MS
    )
    const body = (await res.json().catch(() => null)) as
      | (TranscriptPayload & { error?: unknown; reason?: unknown })
      | null

    if (!res.ok) {
      const reason = body?.reason
      return {
        ok: false,
        status: res.status >= 400 && res.status < 600 ? res.status : 502,
        error: typeof body?.error === 'string' ? body.error : 'Transcript relay failed',
        reason:
          reason === 'invalid-id' || reason === 'no-captions' || reason === 'blocked'
            ? reason
            : 'upstream',
      }
    }

    if (!body || !Array.isArray(body.cues) || body.cues.length === 0) {
      return { ok: false, status: 404, error: 'No captions for this video', reason: 'no-captions' }
    }

    if (!Array.isArray(body.tracks)) body.tracks = []

    return { ok: true, data: body }
  } catch {
    return { ok: false, status: 502, error: 'Transcript relay is not reachable', reason: 'upstream' }
  }
}

function toSeconds(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number / 1000 : 0
}

async function fetchFromSupadata(
  videoId: string,
  lang: string
): Promise<TranscriptResult | null> {
  const key = (process.env.SUPADATA_API_KEY ?? '').trim()
  if (!key) return null

  const params = new URLSearchParams({ videoId, lang })
  try {
    const res = await request(
      `${SUPADATA_URL}?${params.toString()}`,
      { headers: { 'x-api-key': key, Accept: 'application/json' } },
      false,
      SUPADATA_TIMEOUT_MS
    )
    const body = (await res.json().catch(() => null)) as
      | {
          content?: unknown
          lang?: unknown
          availableLangs?: unknown
          error?: unknown
          message?: unknown
        }
      | null

    if (!res.ok) {
      const code = typeof body?.error === 'string' ? body.error : ''
      if (
        res.status === 206 ||
        code === 'transcript-unavailable' ||
        code === 'not-found' ||
        res.status === 404
      ) {
        return { ok: false, status: 404, error: 'No captions for this video', reason: 'no-captions' }
      }
      if (
        code === 'unauthorized' ||
        code === 'forbidden' ||
        res.status === 401 ||
        res.status === 403
      ) {
        return { ok: false, status: 502, error: 'Supadata API key was rejected', reason: 'upstream' }
      }
      if (code === 'limit-exceeded' || res.status === 429) {
        return { ok: false, status: 503, error: 'Supadata rate limit reached', reason: 'upstream' }
      }
      return {
        ok: false,
        status: res.status >= 400 && res.status < 600 ? res.status : 502,
        error: typeof body?.message === 'string' ? body.message : 'Supadata request failed',
        reason: 'upstream',
      }
    }

    const chunks = Array.isArray(body?.content) ? body.content : []
    const cues: TranscriptCue[] = []
    for (const item of chunks) {
      if (!item || typeof item !== 'object') continue
      const chunk = item as { text?: unknown; offset?: unknown; duration?: unknown }
      const text = typeof chunk.text === 'string' ? chunk.text.replace(/\s+/g, ' ').trim() : ''
      if (!text) continue
      cues.push({ start: toSeconds(chunk.offset), dur: toSeconds(chunk.duration), text })
    }

    if (!cues.length) {
      return { ok: false, status: 404, error: 'No captions for this video', reason: 'no-captions' }
    }

    const languageCode = typeof body?.lang === 'string' ? body.lang : lang
    const available = Array.isArray(body?.availableLangs)
      ? body.availableLangs.filter(
          (code): code is string => typeof code === 'string' && code.trim() !== ''
        )
      : []
    const codes = Array.from(new Set([...available, languageCode]))
    const tracks: TranscriptTrack[] = codes.map((code) => ({
      code,
      name: code,
      generated: false,
    }))

    return {
      ok: true,
      data: { videoId, languageCode, isGenerated: false, tracks, cues },
    }
  } catch {
    return { ok: false, status: 502, error: 'Supadata is not reachable', reason: 'upstream' }
  }
}

function readTrackName(track: { name?: unknown; kind?: unknown }, code: string): string {
  const name = track.name
  if (typeof name === 'string' && name.trim()) return name.trim()
  if (name && typeof name === 'object') {
    const candidate = name as { simpleText?: unknown; runs?: Array<{ text?: unknown }> }
    if (typeof candidate.simpleText === 'string' && candidate.simpleText.trim()) {
      return candidate.simpleText.trim()
    }
    if (Array.isArray(candidate.runs)) {
      const joined = candidate.runs
        .map((run) => (typeof run?.text === 'string' ? run.text : ''))
        .join('')
        .trim()
      if (joined) return joined
    }
  }
  return track.kind === 'asr' ? `${code} (auto)` : code
}

function normalizeTracks(input: unknown): RawTrack[] {
  if (!Array.isArray(input)) return []
  const tracks: RawTrack[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const track = item as {
      baseUrl?: unknown
      languageCode?: unknown
      kind?: unknown
      name?: unknown
    }
    const baseUrl = typeof track.baseUrl === 'string' ? track.baseUrl : ''
    const languageCode = typeof track.languageCode === 'string' ? track.languageCode : ''
    if (!baseUrl || !languageCode) continue
    tracks.push({
      baseUrl,
      languageCode,
      kind: typeof track.kind === 'string' ? track.kind : undefined,
      name: readTrackName(track, languageCode),
    })
  }
  return tracks
}

function findJsonArrayEnd(text: string, start: number): number {
  if (text[start] !== '[') return -1
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '[') depth++
    else if (char === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

export function extractCaptionTracksFromHtml(html: string): RawTrack[] {
  const marker = '"captionTracks":'
  const at = html.indexOf(marker)
  if (at === -1) return []
  const start = at + marker.length
  const end = findJsonArrayEnd(html, start)
  if (end === -1) return []
  try {
    return normalizeTracks(JSON.parse(html.slice(start, end + 1)))
  } catch {
    return []
  }
}

interface TrackLoad {
  tracks: RawTrack[]
  blocked: boolean
}

function isBotBlocked(status: { status?: unknown; reason?: unknown } | undefined): boolean {
  if (!status) return false
  const state = typeof status.status === 'string' ? status.status : ''
  const reason = typeof status.reason === 'string' ? status.reason : ''
  return state === 'LOGIN_REQUIRED' && /not a bot/i.test(reason)
}

function looksBlockedPage(html: string): boolean {
  return /sign in to confirm (?:that )?you(?:'|’)re not a bot/i.test(html)
}

async function loadTracks(videoId: string): Promise<TrackLoad> {
  let blocked = false

  try {
    const res = await request(PLAYER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_UA,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: ANDROID_VERSION,
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
            userAgent: ANDROID_UA,
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        captions?: {
          playerCaptionsTracklistRenderer?: { captionTracks?: unknown }
        }
        playabilityStatus?: { status?: unknown; reason?: unknown }
      }
      const tracks = normalizeTracks(data?.captions?.playerCaptionsTracklistRenderer?.captionTracks)
      if (tracks.length) return { tracks, blocked: false }
      if (isBotBlocked(data?.playabilityStatus)) blocked = true
    } else if (res.status === 403 || res.status === 429) {
      blocked = true
    }
  } catch {
    // Fall through to the watch-page scrape.
  }

  try {
    const res = await request(`${WATCH_URL}?v=${encodeURIComponent(videoId)}&hl=en`, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (res.ok) {
      const html = await res.text()
      const tracks = extractCaptionTracksFromHtml(html)
      if (tracks.length) return { tracks, blocked: false }
      if (looksBlockedPage(html)) blocked = true
    } else if (res.status === 403 || res.status === 429) {
      blocked = true
    }
  } catch {
    // No tracks and no further source.
  }

  return { tracks: [], blocked }
}

export function pickTrack(tracks: RawTrack[], lang: string): RawTrack | null {
  if (!tracks.length) return null
  const code = lang.trim().toLowerCase().replace('_', '-')
  if (code) {
    const matches = tracks.filter((track) => {
      const trackCode = (track.languageCode ?? '').toLowerCase().replace('_', '-')
      return trackCode === code || trackCode.startsWith(`${code}-`)
    })
    const manual = matches.find((track) => track.kind !== 'asr')
    if (manual) return manual
    if (matches[0]) return matches[0]
  }
  return tracks.find((track) => track.kind !== 'asr') ?? tracks[0]
}

export function summarizeTracks(tracks: RawTrack[]): TranscriptTrack[] {
  const byCode = new Map<string, TranscriptTrack>()
  for (const track of tracks) {
    const code = (track.languageCode ?? '').toLowerCase()
    if (!code) continue
    const generated = track.kind === 'asr'
    const existing = byCode.get(code)
    if (!existing || (existing.generated && !generated)) {
      byCode.set(code, { code, name: readTrackName(track, code), generated })
    }
  }
  return Array.from(byCode.values())
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function cleanText(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

export function parseJson3(data: unknown): TranscriptCue[] {
  const events =
    data && typeof data === 'object' && Array.isArray((data as { events?: unknown }).events)
      ? ((data as { events: unknown[] }).events)
      : []
  const cues: TranscriptCue[] = []
  for (const event of events) {
    if (!event || typeof event !== 'object') continue
    const record = event as {
      tStartMs?: unknown
      dDurationMs?: unknown
      aAppend?: unknown
      segs?: Array<{ utf8?: unknown }>
    }
    if (!Array.isArray(record.segs)) continue
    const text = record.segs
      .map((seg) => (typeof seg?.utf8 === 'string' ? seg.utf8 : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    const start = Number(record.tStartMs ?? 0) / 1000
    const dur = Number(record.dDurationMs ?? 0) / 1000
    const previous = cues[cues.length - 1]
    if (record.aAppend === 1 && previous) {
      previous.text = `${previous.text} ${text}`.replace(/\s+/g, ' ').trim()
      previous.dur = Math.max(previous.dur, start + dur - previous.start)
      continue
    }
    if (previous && previous.text === text) continue
    cues.push({ start: Number.isFinite(start) ? start : 0, dur: Number.isFinite(dur) ? dur : 0, text })
  }
  return cues
}

export function parseXmlCues(xml: string): TranscriptCue[] {
  const cues: TranscriptCue[] = []
  const paragraph = /<p\b([^>]*)>([\s\S]*?)<\/p>/g
  let match: RegExpExecArray | null
  while ((match = paragraph.exec(xml))) {
    const attrs = match[1]
    const startMs = Number(/\bt="(\d+)"/.exec(attrs)?.[1] ?? NaN)
    const durationMs = Number(/\bd="(\d+)"/.exec(attrs)?.[1] ?? NaN)
    const text = cleanText(match[2])
    if (!text || !Number.isFinite(startMs)) continue
    cues.push({
      start: startMs / 1000,
      dur: Number.isFinite(durationMs) ? durationMs / 1000 : 0,
      text,
    })
  }
  if (cues.length) return cues

  const textTag = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
  while ((match = textTag.exec(xml))) {
    const attrs = match[1]
    const start = Number(/\bstart="([\d.]+)"/.exec(attrs)?.[1] ?? NaN)
    const dur = Number(/\bdur="([\d.]+)"/.exec(attrs)?.[1] ?? NaN)
    const text = cleanText(match[2])
    if (!text || !Number.isFinite(start)) continue
    cues.push({ start, dur: Number.isFinite(dur) ? dur : 0, text })
  }
  return cues
}

async function fetchCues(baseUrl: string): Promise<TranscriptCue[]> {
  const url = decodeEntities(baseUrl)
  const attempts = [`${url}&fmt=json3`, url]
  for (const target of attempts) {
    try {
      const res = await request(target, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      })
      if (!res.ok) continue
      const body = await res.text()
      if (!body) continue
      if (target.endsWith('&fmt=json3')) {
        try {
          const parsed = parseJson3(JSON.parse(body))
          if (parsed.length) return parsed
        } catch {
          // Not JSON; fall through to the XML parser.
        }
      }
      const parsed = parseXmlCues(body)
      if (parsed.length) return parsed
    } catch {
      // Try the next format.
    }
  }
  return []
}

export async function fetchTranscript(videoId: string, lang: string): Promise<TranscriptResult> {
  if (!isVideoId(videoId)) {
    return { ok: false, status: 400, error: 'Invalid video id', reason: 'invalid-id' }
  }

  const relay = await fetchFromRelay(videoId, lang)
  if (relay) return relay

  const supadata = await fetchFromSupadata(videoId, lang)
  if (supadata) return supadata

  const { tracks, blocked } = await loadTracks(videoId)
  if (!tracks.length) {
    if (blocked) {
      return {
        ok: false,
        status: 503,
        error:
          'YouTube is blocking caption requests from this server. Set TRANSCRIPT_RELAY_URL or TRANSCRIPT_PROXY_URL.',
        reason: 'blocked',
      }
    }
    return { ok: false, status: 404, error: 'No captions for this video', reason: 'no-captions' }
  }

  const chosen = pickTrack(tracks, lang)
  if (!chosen?.baseUrl) {
    return { ok: false, status: 404, error: 'No captions for this video', reason: 'no-captions' }
  }

  const cues = await fetchCues(chosen.baseUrl)
  if (!cues.length) {
    return { ok: false, status: 502, error: 'Could not read the caption track', reason: 'upstream' }
  }

  return {
    ok: true,
    data: {
      videoId,
      languageCode: chosen.languageCode ?? '',
      isGenerated: chosen.kind === 'asr',
      tracks: summarizeTracks(tracks),
      cues,
    },
  }
}

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
