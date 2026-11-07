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
