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
 * Choose the caption track to activate. The tracklist is only a hint: YouTube omits
 * auto-generated tracks from it, and language-learning videos commonly rely on those.
 * When the video's language is known we therefore ask for it directly instead of
 * settling for an unrelated manual track or giving up.
 *
 * Returns null only when there is no preferred code and no tracklist entry to use.
 */
export function pickCaptionTrack(
  tracks: CaptionTrack[],
  preferredCode: string,
): CaptionTrack | null {
  const code = normalize(preferredCode)
  if (code) {
    const exact = tracks.find((track) => normalize(track.languageCode) === code)
    if (exact) return exact
    const regional = tracks.find((track) => normalize(track.languageCode).startsWith(`${code}-`))
    if (regional) return regional
    return { languageCode: code }
  }
  return tracks.find((track) => track.is_default) ?? tracks[0] ?? null
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

/**
 * Turn captions off by clearing the active track. `unloadModule` is undocumented and
 * captions can reappear after pause/play, so it is only the fallback.
 */
export function disableCaptions(player: YouTubePlayer | null | undefined): void {
  if (player?.setOption) {
    try {
      player.setOption('captions', 'track', {})
      return
    } catch {
      // Fall through to unloading the module.
    }
  }
  if (!player?.unloadModule) return
  try {
    player.unloadModule('captions')
  } catch {
    // The module was not loaded; there is nothing to unload.
  }
}

/** Read the caption track the player currently has active, if it exposes one. */
export function readActiveCaptionTrack(
  player: YouTubePlayer | null | undefined,
): CaptionTrack | null {
  if (!player?.getOption) return null
  try {
    const track = player.getOption('captions', 'track')
    if (!track || typeof track !== 'object') return null
    const active = track as CaptionTrack
    return active.languageCode ? active : null
  } catch {
    return null
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
