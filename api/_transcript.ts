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

export type TranscriptFailureReason = 'invalid-id' | 'no-captions' | 'upstream'

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

export function isVideoId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id)
}

async function request(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
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

async function loadTracks(videoId: string): Promise<RawTrack[]> {
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
      }
      const tracks = normalizeTracks(data?.captions?.playerCaptionsTracklistRenderer?.captionTracks)
      if (tracks.length) return tracks
    }
  } catch {
    // Fall through to the watch-page scrape.
  }

  try {
    const res = await request(`${WATCH_URL}?v=${encodeURIComponent(videoId)}&hl=en`, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (!res.ok) return []
    return extractCaptionTracksFromHtml(await res.text())
  } catch {
    return []
  }
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

  const tracks = await loadTracks(videoId)
  if (!tracks.length) {
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
