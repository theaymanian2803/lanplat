export const maxDuration = 60

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek/deepseek-v3.2'
const REQUEST_TIMEOUT_MS = 40000
const MAX_TURNS = 12
const MAX_TURN_CHARS = 4000
const MAX_CONTEXT_CHARS = 20000
const MAX_TOKENS = 700

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX_REQUESTS = 30
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export interface TutorTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface TutorRequest {
  messages: TutorTurn[]
  word?: string
  translation?: string
  language?: string
  answerLanguage?: string
  note?: string
  transcript?: string
  title?: string
}

export type TutorResult =
  | { ok: true; reply: string }
  | { ok: false; status: number; error: string }

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text ? text.slice(0, max) : undefined
}

/** Validates and bounds a chat payload. Returns null for anything malformed. */
export function parseTutorRequest(body: unknown): TutorRequest | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  if (!Array.isArray(raw.messages) || raw.messages.length === 0) return null
  if (raw.messages.length > MAX_TURNS) return null

  const messages: TutorTurn[] = []
  let total = 0
  for (const entry of raw.messages) {
    if (!entry || typeof entry !== 'object') return null
    const { role, content } = entry as Record<string, unknown>
    if (role !== 'user' && role !== 'assistant') return null
    if (typeof content !== 'string') return null
    const text = content.trim()
    if (!text || text.length > MAX_TURN_CHARS) return null
    total += text.length
    messages.push({ role, content: text })
  }

  const word = clean(raw.word, 500)
  const translation = clean(raw.translation, 1000)
  const language = clean(raw.language, 60)
  const answerLanguage = clean(raw.answerLanguage, 60)
  const note = clean(raw.note, 2000)
  const transcript = clean(raw.transcript, 6000)
  const title = clean(raw.title, 300)
  total +=
    (word?.length ?? 0) +
    (translation?.length ?? 0) +
    (note?.length ?? 0) +
    (transcript?.length ?? 0) +
    (title?.length ?? 0)
  if (total > MAX_CONTEXT_CHARS) return null

  return {
    messages,
    word,
    translation,
    language,
    answerLanguage,
    note,
    transcript,
    title,
  }
}

export function buildSystemPrompt(input: TutorRequest): string {
  const answerLanguage = input.answerLanguage ?? 'English'
  const lines = [
    'You are a patient, precise language tutor inside a vocabulary notebook.',
    `Answer in ${answerLanguage}.`,
    'Keep replies short: under 180 words unless the learner asks for more detail.',
    'Use simple sentences and concrete examples.',
    'When explaining a word, give its meaning, one or two natural example sentences, and any useful register or grammar note.',
    'If the learner writes in Arabic, still answer in the requested language.',
    'Never invent facts about the book, author, or etymology. Say when you are unsure.',
  ]
  if (input.language) lines.push(`The learner is studying ${input.language}.`)
  if (input.word) lines.push(`The word or phrase in focus is: "${input.word}".`)
  if (input.translation) {
    lines.push(`The learner's own translation of it is: "${input.translation}".`)
  }
  if (input.title) lines.push(`The current material is: "${input.title}".`)
  if (input.note) lines.push(`The learner's own note about it: "${input.note}".`)
  if (input.transcript) {
    lines.push(`Excerpt from the material they are reading:\n"""${input.transcript}"""`)
  }
  return lines.join('\n')
}

export async function chatWithTutor(
  input: TutorRequest,
  options: { apiKey?: string; model?: string; fetchImpl?: typeof fetch } = {},
): Promise<TutorResult> {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'AI chat is not configured. Add OPENROUTER_API_KEY to the server environment.',
    }
  }

  const model = options.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL
  const doFetch = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await doFetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://lingovault.app',
        'X-Title': 'LingoVault',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(input) },
          ...input.messages.map((turn) => ({ role: turn.role, content: turn.content })),
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.5,
      }),
      signal: controller.signal,
    })

    const data = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: unknown } }>
    } | null

    if (!response.ok) {
      if (response.status === 429) {
        return {
          ok: false,
          status: 429,
          error: 'The AI tutor is busy right now. Try again in a moment.',
        }
      }
      return { ok: false, status: 502, error: 'AI chat is unavailable right now.' }
    }

    const reply = data?.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) {
      return { ok: false, status: 502, error: 'The AI tutor sent an empty reply.' }
    }

    return { ok: true, reply: reply.trim() }
  } catch (error) {
    const timedOut =
      typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      error: timedOut
        ? 'The AI tutor took too long to reply. Try again.'
        : 'AI chat is unavailable right now.',
    }
  } finally {
    clearTimeout(timer)
  }
}

function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const first = forwarded.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'local'
}

function rateLimited(key: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_MAX_REQUESTS
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'GET') {
      return Response.json({ configured: Boolean(process.env.OPENROUTER_API_KEY) })
    }
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }
    if (rateLimited(clientKey(req))) {
      return Response.json(
        { error: 'Too many messages in a short time. Take a short break and try again.' },
        { status: 429 },
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const input = parseTutorRequest(body)
    if (!input) {
      return Response.json({ error: 'Invalid chat request' }, { status: 400 })
    }

    const result = await chatWithTutor(input)
    if ('error' in result) {
      return Response.json({ error: result.error }, { status: result.status })
    }
    return Response.json({ reply: result.reply })
  },
}
