import { cacheGet, cacheSet } from '@/lib/offlineCache'
import { formatTimestamp } from '@/lib/youtube'

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

const LANGUAGE_CODES: Record<string, string> = {
  Danish: 'da',
  Japanese: 'ja',
  Spanish: 'es',
  French: 'fr',
  Swedish: 'sv',
  English: 'en',
}

export function toCaptionCode(language: string): string {
  const normalized = language.trim().toLowerCase()
  const match = Object.keys(LANGUAGE_CODES).find(
    (name) => name.toLowerCase() === normalized,
  )
  if (match) return LANGUAGE_CODES[match]
  return normalized.slice(0, 2)
}

const cacheKey = (videoId: string, code: string) => `transcript:${videoId}:${code}`

export async function loadTranscript(
  videoId: string,
  code: string,
): Promise<TranscriptPayload> {
  const cached = cacheGet<TranscriptPayload>(cacheKey(videoId, code))
  if (cached) return cached

  const params = new URLSearchParams({ videoId, lang: code })
  const res = await fetch(`/api/transcript?${params.toString()}`)

  if (!res.ok) {
    let message = `Transcript request failed: ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // Keep the status-based message.
    }
    const error = new Error(message) as Error & { status?: number }
    error.status = res.status
    throw error
  }

  const data = (await res.json()) as TranscriptPayload
  if (!Array.isArray(data?.cues) || data.cues.length === 0) {
    throw new Error('No captions for this video')
  }

  cacheSet(cacheKey(videoId, code), data)
  return data
}

/** Index of the last cue that has started at `seconds`, or -1 before the first cue. */
export function findActiveCueIndex(cues: TranscriptCue[], seconds: number): number {
  let low = 0
  let high = cues.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (cues[mid].start <= seconds) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

export function cueContext(cue: TranscriptCue): string {
  return `${cue.text} — ${formatTimestamp(Math.floor(cue.start))}`
}
