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

  it('stores the name, not the slug', () => {
    setTargetLanguage('Danish')
    expect(getTargetLanguage()).toBe('Danish')
  })
})
