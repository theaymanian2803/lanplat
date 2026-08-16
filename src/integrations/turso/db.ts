import { getTursoClient } from './client'
import type { Note, Screenshot, Video, VocabWord } from './types'

const turso = getTursoClient()

export const LOCAL_USER_ID = 'local-user'

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vocabulary (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  language TEXT NOT NULL,
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  context_note TEXT,
  created_at TEXT NOT NULL,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  next_review_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS screenshots (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS languages (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
`

export async function ensureSchema(): Promise<void> {
  await turso.executeMultiple(SCHEMA_SQL)
  await turso.batch(
    [
      { sql: "INSERT OR IGNORE INTO languages (name, created_at) VALUES ('Danish', ?)", args: [now()] },
      { sql: "INSERT OR IGNORE INTO languages (name, created_at) VALUES ('Japanese', ?)", args: [now()] },
      { sql: "INSERT OR IGNORE INTO languages (name, created_at) VALUES ('Spanish', ?)", args: [now()] },
    ],
    'write'
  )
}

const newId = () => crypto.randomUUID()
const now = () => new Date().toISOString()

export const videosDb = {
  async list(language?: string): Promise<Video[]> {
    const rs = language
      ? await turso.execute({
          sql: 'SELECT * FROM videos WHERE language = ? ORDER BY created_at DESC',
          args: [language],
        })
      : await turso.execute('SELECT * FROM videos ORDER BY created_at DESC')
    return rs.rows as unknown as Video[]
  },

  async get(id: string): Promise<Video | null> {
    const rs = await turso.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [id] })
    return (rs.rows[0] as unknown as Video) ?? null
  },

  async insert(input: { youtube_url: string; title: string; language: string }): Promise<void> {
    await turso.execute({
      sql: 'INSERT INTO videos (id, user_id, youtube_url, title, language, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [newId(), LOCAL_USER_ID, input.youtube_url, input.title, input.language, now()],
    })
  },

  async remove(id: string): Promise<void> {
    await turso.batch(
      [
        { sql: 'DELETE FROM notes WHERE video_id = ?', args: [id] },
        { sql: 'DELETE FROM screenshots WHERE video_id = ?', args: [id] },
        { sql: 'DELETE FROM videos WHERE id = ?', args: [id] },
      ],
      'write'
    )
  },
}

export const vocabularyDb = {
  async list(language?: string): Promise<VocabWord[]> {
    const rs = language
      ? await turso.execute({
          sql: 'SELECT * FROM vocabulary WHERE language = ? ORDER BY created_at DESC',
          args: [language],
        })
      : await turso.execute('SELECT * FROM vocabulary ORDER BY created_at DESC')
    return rs.rows as unknown as VocabWord[]
  },

  async insert(input: {
    language: string
    word: string
    translation: string
    context_note: string | null
  }): Promise<void> {
    await turso.execute({
      sql: 'INSERT INTO vocabulary (id, user_id, language, word, translation, context_note, created_at, mastery_level, next_review_date) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
      args: [
        newId(),
        LOCAL_USER_ID,
        input.language,
        input.word,
        input.translation,
        input.context_note,
        now(),
        now(),
      ],
    })
  },

  async updateSrs(id: string, srs: { mastery_level: number; next_review_date: string }): Promise<void> {
    await turso.execute({
      sql: 'UPDATE vocabulary SET mastery_level = ?, next_review_date = ? WHERE id = ?',
      args: [srs.mastery_level, srs.next_review_date, id],
    })
  },

  async remove(id: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM vocabulary WHERE id = ?', args: [id] })
  },

  async listDue(before: string): Promise<VocabWord[]> {
    const rs = await turso.execute({
      sql: 'SELECT * FROM vocabulary WHERE next_review_date <= ? ORDER BY next_review_date ASC',
      args: [before],
    })
    return rs.rows as unknown as VocabWord[]
  },
}

export const notesDb = {
  async listByVideo(videoId: string): Promise<Note[]> {
    const rs = await turso.execute({
      sql: 'SELECT * FROM notes WHERE video_id = ? ORDER BY timestamp ASC',
      args: [videoId],
    })
    return rs.rows as unknown as Note[]
  },

  async insert(input: { video_id: string; timestamp: number; content: string }): Promise<void> {
    await turso.execute({
      sql: 'INSERT INTO notes (id, video_id, user_id, timestamp, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [newId(), input.video_id, LOCAL_USER_ID, input.timestamp, input.content, now()],
    })
  },

  async remove(id: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM notes WHERE id = ?', args: [id] })
  },
}

export const screenshotsDb = {
  async listByVideo(videoId: string): Promise<Screenshot[]> {
    const rs = await turso.execute({
      sql: 'SELECT * FROM screenshots WHERE video_id = ? ORDER BY timestamp ASC',
      args: [videoId],
    })
    return rs.rows as unknown as Screenshot[]
  },

  async insert(input: { video_id: string; timestamp: number; image_url: string }): Promise<void> {
    await turso.execute({
      sql: 'INSERT INTO screenshots (id, video_id, user_id, timestamp, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [newId(), input.video_id, LOCAL_USER_ID, input.timestamp, input.image_url, now()],
    })
  },

  async remove(id: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM screenshots WHERE id = ?', args: [id] })
  },
}

export const languagesDb = {
  async list(): Promise<string[]> {
    const rs = await turso.execute('SELECT name FROM languages ORDER BY name ASC')
    return rs.rows.map((r) => String(r.name))
  },

  async add(name: string): Promise<void> {
    await turso.execute({
      sql: 'INSERT INTO languages (name, created_at) VALUES (?, ?)',
      args: [name, now()],
    })
  },

  async remove(name: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM languages WHERE name = ?', args: [name] })
  },
}
