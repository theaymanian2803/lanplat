import type { YouTubePlayer } from '@/lib/youtubePlayer'

/** One entry of `player.getOption('captions', 'tracklist')`. */
export interface CaptionTrack {
  languageCode?: string
  languageName?: string
  displayName?: string
  kind?: string
  is_default?: boolean
}

function normalize(code: string | undefined): string {
  return (code ?? '').trim().toLowerCase()
}

/** Read the available caption tracks without throwing when the module is not loaded. */
export function readCaptionTracks(player: YouTubePlayer | null | undefined): CaptionTrack[] {
  if (!player?.getOption) return []
  try {
    const tracks = player.getOption('captions', 'tracklist')
    return Array.isArray(tracks) ? (tracks as CaptionTrack[]) : []
  } catch {
    return []
  }
}

/**
 * Prefer the video's language, then a regional variant of it, then YouTube's
 * default track. Returns null when the video has no caption tracks.
 */
export function pickCaptionTrack(
  tracks: CaptionTrack[],
  preferredCode: string,
): CaptionTrack | null {
  if (tracks.length === 0) return null
  const code = normalize(preferredCode)
  if (code) {
    const exact = tracks.find((track) => normalize(track.languageCode) === code)
    if (exact) return exact
    const regional = tracks.find((track) => normalize(track.languageCode).startsWith(`${code}-`))
    if (regional) return regional
  }
  return tracks.find((track) => track.is_default) ?? tracks[0]
}

/** Load and turn on the captions module, choosing the best matching track. */
export function enableCaptions(
  player: YouTubePlayer | null | undefined,
  preferredCode: string,
): boolean {
  if (!player?.loadModule) return false
  try {
    player.loadModule('captions')
  } catch {
    return false
  }
  // The tracklist may only be populated after `onApiChange`; applying here
  // covers players where the module is already cached from a previous load.
  applyCaptionTrack(player, preferredCode)
  return true
}

/** Turn captions off again, leaving the native chrome untouched. */
export function disableCaptions(player: YouTubePlayer | null | undefined): void {
  if (!player?.unloadModule) return
  try {
    player.unloadModule('captions')
  } catch {
    // The module was not loaded; there is nothing to unload.
  }
}

/** Select a track once the captions module exposes its tracklist. */
export function applyCaptionTrack(
  player: YouTubePlayer | null | undefined,
  preferredCode: string,
): CaptionTrack | null {
  if (!player?.setOption) return null
  const track = pickCaptionTrack(readCaptionTracks(player), preferredCode)
  if (!track) return null
  try {
    player.setOption('captions', 'track', track)
  } catch {
    return null
  }
  return track
}
