import { describe, expect, it, vi } from 'vitest'

import {
  applyCaptionTrack,
  disableCaptions,
  enableCaptions,
  pickCaptionTrack,
  readCaptionTracks,
  type CaptionTrack,
} from '@/lib/youtubeCaptions'
import type { YouTubePlayer } from '@/lib/youtubePlayer'

const TRACKS: CaptionTrack[] = [
  { languageCode: 'en', languageName: 'English' },
  { languageCode: 'da', languageName: 'Danish' },
  { languageCode: 'pt-BR', languageName: 'Portuguese (Brazil)' },
]

function fakePlayer(overrides: Partial<YouTubePlayer> = {}): YouTubePlayer {
  return {
    loadModule: vi.fn(),
    unloadModule: vi.fn(),
    getOption: vi.fn(() => TRACKS),
    setOption: vi.fn(),
    ...overrides,
  }
}

describe('youtubeCaptions', () => {
  it('picks the exact track for the requested language', () => {
    expect(pickCaptionTrack(TRACKS, 'da')?.languageCode).toBe('da')
    expect(pickCaptionTrack(TRACKS, 'DA')?.languageCode).toBe('da')
  })

  it('falls back to a regional variant before the default track', () => {
    expect(pickCaptionTrack(TRACKS, 'pt')?.languageCode).toBe('pt-BR')
  })

  it("falls back to the player's default track", () => {
    const tracks = [{ languageCode: 'en' }, { languageCode: 'fr', is_default: true }]
    expect(pickCaptionTrack(tracks, 'de')?.languageCode).toBe('fr')
  })

  it('returns null when the video has no captions', () => {
    expect(pickCaptionTrack([], 'en')).toBeNull()
    expect(readCaptionTracks(fakePlayer({ getOption: vi.fn(() => null) }))).toEqual([])
  })

  it('loads the captions module and selects the matching track', () => {
    const player = fakePlayer()

    expect(enableCaptions(player, 'da')).toBe(true)
    expect(player.loadModule).toHaveBeenCalledWith('captions')
    expect(player.setOption).toHaveBeenCalledWith('captions', 'track', TRACKS[1])
  })

  it('reports failure when the player cannot load modules', () => {
    expect(enableCaptions({}, 'en')).toBe(false)
  })

  it('unloads the captions module to turn captions off', () => {
    const player = fakePlayer()

    disableCaptions(player)

    expect(player.unloadModule).toHaveBeenCalledWith('captions')
  })

  it('does nothing when the tracklist is not readable yet', () => {
    const player = fakePlayer({ getOption: vi.fn(() => null) })

    expect(applyCaptionTrack(player, 'en')).toBeNull()
    expect(player.setOption).not.toHaveBeenCalled()
  })
})
