import { beforeEach, describe, expect, it } from 'vitest'
import { getTargetLanguage, setTargetLanguage } from './targetLanguage'

describe('targetLanguage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is null until a language is chosen', () => {
    expect(getTargetLanguage()).toBeNull()
  })

  it('reads back what was written', () => {
    setTargetLanguage('Japanese')
    expect(getTargetLanguage()).toBe('Japanese')
  })

  it('keeps only the latest choice', () => {
    setTargetLanguage('Danish')
    setTargetLanguage('Spanish')
    expect(getTargetLanguage()).toBe('Spanish')
  })

  it('survives a fresh module read, because it is a stored preference', () => {
    setTargetLanguage('Spanish')
    // Reading the key directly proves it is in localStorage, not sessionStorage.
    expect(localStorage.getItem('lingovault_target_language')).toBe('Spanish')
    expect(sessionStorage.getItem('lingovault_target_language')).toBeNull()
  })

  it('stores the name verbatim, not the slug', () => {
    // `Danish` is the languages.name value the app filters on; `danish` is its URL slug.
    // Asserting on the stored bytes rather than the getter pins the write path, so a
    // slugifying writer cannot hide behind a getter that maps the value back.
    setTargetLanguage('Danish')
    expect(localStorage.getItem('lingovault_target_language')).toBe('Danish')
  })

  it('reads back the stored value without normalising it', () => {
    // Seeded directly so the writer never produces the value under test: whichever form
    // reached storage is the form the app will later filter on.
    localStorage.setItem('lingovault_target_language', 'danish')
    expect(getTargetLanguage()).toBe('danish')
  })
})
