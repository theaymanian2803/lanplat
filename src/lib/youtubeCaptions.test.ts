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

  it('prefers the video language over an unrelated track', () => {
    const tracks = [{ languageCode: 'en' }, { languageCode: 'fr', is_default: true }]
    expect(pickCaptionTrack(tracks, 'de')).toEqual({ languageCode: 'de' })
  })

  it('falls back to the default track when no language is requested', () => {
    const tracks = [{ languageCode: 'en' }, { languageCode: 'fr', is_default: true }]
    expect(pickCaptionTrack(tracks, '')?.languageCode).toBe('fr')
  })

  it('returns null when there is neither a language nor a track list', () => {
    expect(pickCaptionTrack([], '')).toBeNull()
    expect(readCaptionTracks(fakePlayer({ getOption: vi.fn(() => null) }))).toEqual([])
  })

  it('loads the captions module and selects the matching track', () => {
    const player = fakePlayer()

    expect(enableCaptions(player, 'da')).toBe(true)
    expect(player.loadModule).toHaveBeenCalledWith('captions')
    expect(player.setOption).toHaveBeenCalledWith('captions', 'track', TRACKS[1])
  })

  it('asks for the video language when auto captions are missing from the track list', () => {
    const player = fakePlayer({ getOption: vi.fn(() => []) })

    expect(enableCaptions(player, 'da')).toBe(true)
    expect(player.setOption).toHaveBeenCalledWith('captions', 'track', { languageCode: 'da' })
  })

  it('reports failure when the player cannot load modules', () => {
    expect(enableCaptions({}, 'en')).toBe(false)
  })

  it('clears the active track to turn captions off', () => {
    const player = fakePlayer()

    disableCaptions(player)

    expect(player.setOption).toHaveBeenCalledWith('captions', 'track', {})
  })

  it('falls back to unloading the module when options cannot be set', () => {
    const unloadModule = vi.fn()

    disableCaptions({ unloadModule })

    expect(unloadModule).toHaveBeenCalledWith('captions')
  })

  it('does nothing when the player exposes no caption options', () => {
    const player = fakePlayer({ getOption: vi.fn(() => null) })

    expect(applyCaptionTrack(player, '')).toBeNull()
    expect(player.setOption).not.toHaveBeenCalled()
  })

  it('requests the language directly when the track list is not readable yet', () => {
    const player = fakePlayer({ getOption: vi.fn(() => null) })

    expect(applyCaptionTrack(player, 'en')).toEqual({ languageCode: 'en' })
    expect(player.setOption).toHaveBeenCalledWith('captions', 'track', { languageCode: 'en' })
  })
})
