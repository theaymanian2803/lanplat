import { describe, expect, it } from 'vitest'
import { ttsLangCode } from '@/lib/tts'

describe('ttsLangCode', () => {
  it('maps known languages to Google TTS codes', () => {
    expect(ttsLangCode('Danish')).toBe('da')
    expect(ttsLangCode('Swedish')).toBe('sv')
    expect(ttsLangCode('sweeden')).toBe('sv')
    expect(ttsLangCode('Japanese')).toBe('ja')
    expect(ttsLangCode('Spanish')).toBe('es')
    expect(ttsLangCode('French')).toBe('fr')
    expect(ttsLangCode('English')).toBe('en')
  })

  it('trims whitespace and matches case-insensitively by exact name', () => {
    expect(ttsLangCode('  Danish  ')).toBe('da')
  })

  it('falls back to English for unknown languages', () => {
    expect(ttsLangCode('Klingon')).toBe('en')
    expect(ttsLangCode('')).toBe('en')
  })
})