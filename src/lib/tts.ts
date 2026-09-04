const TTS_LANG_CODES: Record<string, string> = {
  Danish: 'da',
  Swedish: 'sv',
  sweeden: 'sv',
  Japanese: 'ja',
  Spanish: 'es',
  French: 'fr',
  English: 'en',
}

const MAX_CHARS = 200

export function ttsLangCode(language: string): string {
  return TTS_LANG_CODES[language.trim()] ?? 'en'
}

let audioEl: HTMLAudioElement | null = null

function getAudioElement(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.preload = 'auto'
  }
  return audioEl
}

export function speakWord(word: string, language: string): Promise<void> {
  const text = word.trim().slice(0, MAX_CHARS)
  if (!text) return Promise.resolve()

  const url =
    `https://translate.google.com/translate_tts` +
    `?ie=UTF-8&client=tw-ob&tl=${ttsLangCode(language)}&q=${encodeURIComponent(text)}`

  return new Promise((resolve, reject) => {
    const audio = getAudioElement()
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('Could not play audio'))
    audio.src = url
    audio.play().catch(() => reject(new Error('Could not play audio')))
  })
}