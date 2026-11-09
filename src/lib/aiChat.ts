export interface TutorTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface TutorContext {
  /** The word or phrase the conversation is about, if any. */
  word?: string
  /** The learner's translation of the word, when the form has one. */
  translation?: string
  /** Language the learner is studying, e.g. "French". */
  language?: string
  /** Language the tutor should answer in, e.g. "English" or "Arabic". */
  answerLanguage?: string
  /** The learner's own note. */
  note?: string
  /** Excerpt of the material being read. */
  transcript?: string
  /** Title of the book, video, or item being studied. */
  title?: string
}

const MAX_TURNS = 10

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown }
    if (typeof data.error === 'string' && data.error.trim()) return data.error
  } catch {
    // fall through to the generic message
  }
  return 'AI chat is unavailable right now.'
}

/** Sends the conversation so far and the current study context to the tutor proxy. */
export async function askTutor(
  messages: TutorTurn[],
  context: TutorContext = {},
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-MAX_TURNS), ...context }),
    signal,
  })

  if (!res.ok) throw new Error(await readError(res))

  const data = (await res.json()) as { reply?: unknown }
  if (typeof data.reply !== 'string' || !data.reply.trim()) {
    throw new Error('The AI tutor sent an empty reply.')
  }
  return data.reply.trim()
}
