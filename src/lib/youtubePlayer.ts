import { toCaptionCode } from '@/lib/youtubeTranscript'

/**
 * The subset of the YouTube IFrame player API the Study Room relies on. Keeping it in one
 * place means the controls and the transcript strip share a typed handle instead of `any`.
 */
export interface YouTubePlayer {
  getCurrentTime?: () => number
  getPlayerState?: () => number
  getPlaybackRate?: () => number
  pauseVideo?: () => void
  playVideo?: () => void
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void
  setPlaybackRate?: (rate: number) => void
  // Captions module. YouTube only exposes these after `loadModule('captions')`
  // and fires `onApiChange` once the module (and its tracklist) is ready.
  loadModule?: (module: string) => void
  unloadModule?: (module: string) => void
  getOption?: (module: string, option: string) => unknown
  setOption?: (module: string, option: string, value: unknown) => void
}

export interface PlayerVars {
  controls: number
  modestbranding: number
  rel: number
  playsinline: number
  cc_lang_pref?: string
}

/**
 * Player configuration for the Study Room. The native YouTube chrome stays on so the
 * learner keeps the scrubber, volume, quality menu, fullscreen and the CC button. Setting
 * `controls: 0` removes all of that, which is why it must not come back.
 *
 * `cc_load_policy` is deliberately omitted: 1 would force captions on for everyone, while
 * 0 or omitted respects the viewer's own preference. The in-app CC button drives captions
 * through the IFrame captions module instead.
 */
export function buildPlayerVars(language: string): PlayerVars {
  const code = toCaptionCode(language)
  return {
    controls: 1,
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
    ...(code ? { cc_lang_pref: code } : {}),
  }
}

