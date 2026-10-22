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
}
