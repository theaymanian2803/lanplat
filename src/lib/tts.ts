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

export function speakWord(word: string, language: string, speed = 1): Promise<void> {
  const text = word.trim().slice(0, MAX_CHARS)
  if (!text) return Promise.resolve()

  const url =
    `https://translate.google.com/translate_tts` +
    `?ie=UTF-8&client=tw-ob&tl=${ttsLangCode(language)}&q=${encodeURIComponent(text)}` +
    (speed !== 1 ? `&ttsspeed=${speed}` : '')

  return new Promise((resolve, reject) => {
    const audio = getAudioElement()
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('Could not play audio'))
    audio.src = url
    audio.play().catch(() => reject(new Error('Could not play audio')))
  })
}

export function splitSentences(text: string): string[] {
  return (
    text.match(/[^.!?。！？…]+[.!?。！？…]*\s*/g)?.filter((s) => s.trim()) ?? []
  )
}

export interface TextSpeakerCallbacks {
  onSentenceChange: (index: number) => void
  onDone: () => void
  onError: () => void
}

export class TextSpeaker {
  private sentences: string[] = []
  private index = 0
  private stopped = true
  private language = ''
  private speed = 1
  private callbacks: TextSpeakerCallbacks | null = null

  get playing(): boolean {
    return !this.stopped
  }

  start(
    text: string,
    language: string,
    speed: number,
    callbacks: TextSpeakerCallbacks
  ): void {
    this.stop()
    this.sentences = splitSentences(text)
    if (this.sentences.length === 0) return
    this.language = language
    this.speed = speed
    this.callbacks = callbacks
    this.stopped = false
    this.index = 0
    this.callbacks.onSentenceChange(0)
    this.playCurrent()
  }

  stop(): void {
    this.stopped = true
    getAudioElement().pause()
  }

  private playCurrent(): void {
    if (this.stopped) return
    speakWord(this.sentences[this.index], this.language, this.speed)
      .then(() => {
        if (this.stopped) return
        this.index += 1
        if (this.index < this.sentences.length) {
          this.callbacks?.onSentenceChange(this.index)
          this.playCurrent()
        } else {
          this.stopped = true
          this.callbacks?.onDone()
        }
      })
      .catch(() => {
        this.stopped = true
        this.callbacks?.onError()
      })
  }
}