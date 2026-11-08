import { describe, expect, it } from 'vitest'

import { buildPlayerVars } from '@/lib/youtubePlayer'

describe('buildPlayerVars', () => {
  it('keeps the native YouTube control bar on the player', () => {
    expect(buildPlayerVars('Danish').controls).toBe(1)
  })

  it('prefers the video language for captions', () => {
    expect(buildPlayerVars('Danish').cc_lang_pref).toBe('da')
    expect(buildPlayerVars('').cc_lang_pref).toBeUndefined()
  })

  it('does not override the viewer caption preference', () => {
    expect(buildPlayerVars('Danish')).not.toHaveProperty('cc_load_policy')
  })
})
