import { describe, expect, it } from 'vitest'

import {
  cueContext,
  findActiveCueIndex,
  toCaptionCode,
  type TranscriptCue,
} from './youtubeTranscript'

const cues: TranscriptCue[] = [
  { start: 0, dur: 2, text: 'hej' },
  { start: 5, dur: 2, text: 'verden' },
  { start: 10, dur: 2, text: 'igen' },
]

describe('toCaptionCode', () => {
  it('maps the app language names to caption codes', () => {
    expect(toCaptionCode('Danish')).toBe('da')
    expect(toCaptionCode('danish')).toBe('da')
    expect(toCaptionCode('Japanese')).toBe('ja')
    expect(toCaptionCode('French')).toBe('fr')
  })

  it('falls back to the first two letters', () => {
    expect(toCaptionCode('Klingon')).toBe('kl')
    expect(toCaptionCode('pt-BR')).toBe('pt')
  })
})

describe('findActiveCueIndex', () => {
  it('returns -1 before the first cue', () => {
    expect(findActiveCueIndex(cues, -1)).toBe(-1)
    expect(findActiveCueIndex([], 5)).toBe(-1)
  })

  it('finds the last cue that has started', () => {
    expect(findActiveCueIndex(cues, 0)).toBe(0)
    expect(findActiveCueIndex(cues, 4.9)).toBe(0)
    expect(findActiveCueIndex(cues, 5)).toBe(1)
    expect(findActiveCueIndex(cues, 12)).toBe(2)
  })
})

describe('cueContext', () => {
  it('includes the spoken line and its timestamp', () => {
    expect(cueContext({ start: 84, dur: 2, text: 'jeg forstår det ikke' })).toBe(
      'jeg forstår det ikke — 1:24'
    )
  })
})
