import { describe, expect, it } from 'vitest'
import { splitSentences, ttsLangCode } from '@/lib/tts'

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

describe('splitSentences', () => {
  it('splits on sentence-ending punctuation', () => {
    expect(splitSentences('Hej! Jag heter Aymane. Trevligt att träffas.')).toEqual([
      'Hej! ',
      'Jag heter Aymane. ',
      'Trevligt att träffas.',
    ])
  })

  it('handles Japanese sentence punctuation', () => {
    expect(splitSentences('こんにちは。元気ですか？')).toEqual(['こんにちは。', '元気ですか？'])
  })

  it('keeps a trailing sentence without punctuation', () => {
    expect(splitSentences('Ett en. Två')).toEqual(['Ett en. ', 'Två'])
  })

  it('returns [] for empty text', () => {
    expect(splitSentences('')).toEqual([])
    expect(splitSentences('   ')).toEqual([])
  })
})