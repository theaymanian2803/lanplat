import { getTursoClient } from './client'
import { buildLessonTree, type NestedLesson } from '@/lib/lessonTree'
import type { Lesson, Note, Part, Screenshot, Sublesson, Video, VocabWord } from './types'

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

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_type TEXT,
  media_id TEXT,
  title TEXT NOT NULL,
  language TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sublessons (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  sublesson_id TEXT NOT NULL REFERENCES sublessons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
`

export async function ensureSchema(): Promise<void> {
  await turso.executeMultiple(SCHEMA_SQL)
  const lessonCols = await turso.execute('PRAGMA table_info(lessons)')
  if (!lessonCols.rows.some((c) => c.name === 'language')) {
    await turso.execute('ALTER TABLE lessons ADD COLUMN language TEXT')
  }
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

const MAX_QUERY = 'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos'

async function nextPosition(table: string, column: string, parentId: string): Promise<number> {
  const rs = await turso.execute({
    sql: `SELECT COALESCE(MAX(${column}), 0) + 1 AS next_pos FROM ${table} WHERE ${parentId}_id = ?`,
    args: [parentId],
  })
  return Number(rs.rows[0]?.next_pos ?? 1)
}

export const lessonsDb = {
  async list(): Promise<NestedLesson[]> {
    const [lessonRs, sublessonRs, partRs] = await Promise.all([
      turso.execute('SELECT * FROM lessons ORDER BY created_at ASC'),
      turso.execute('SELECT * FROM sublessons ORDER BY lesson_id ASC, position ASC'),
      turso.execute('SELECT * FROM parts ORDER BY sublesson_id ASC, position ASC'),
    ])
    return buildLessonTree(
      lessonRs.rows as unknown as Lesson[],
      sublessonRs.rows as unknown as Sublesson[],
      partRs.rows as unknown as Part[],
    )
  },

  async createLesson(input: {
    title: string
    media_type: Lesson['media_type']
    media_id: string | null
    language: string | null
  }): Promise<string> {
    const id = newId()
    await turso.execute({
      sql: 'INSERT INTO lessons (id, user_id, media_type, media_id, title, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, LOCAL_USER_ID, input.media_type, input.media_id, input.title, input.language, now()],
    })
    return id
  },

  async updateLesson(
    id: string,
    input: {
      title?: string
      media_type?: Lesson['media_type']
      media_id?: string | null
      language?: string | null
    },
  ): Promise<void> {
    const sets: string[] = []
    const args: string[] = []
    if (input.title !== undefined) {
      sets.push('title = ?')
      args.push(input.title)
    }
    if (input.media_type !== undefined) {
      sets.push('media_type = ?')
      args.push(input.media_type ?? null)
    }
    if (input.media_id !== undefined) {
      sets.push('media_id = ?')
      args.push(input.media_id ?? null)
    }
    if (input.language !== undefined) {
      sets.push('language = ?')
      args.push(input.language ?? null)
    }
    if (sets.length === 0) return
    args.push(id)
    await turso.execute({ sql: `UPDATE lessons SET ${sets.join(', ')} WHERE id = ?`, args })
  },

  async removeLesson(id: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM lessons WHERE id = ?', args: [id] })
  },

  async createSublesson(input: { lesson_id: string; title: string }): Promise<string> {
    const id = newId()
    const position = await nextPosition('sublessons', 'position', 'lesson')
    await turso.execute({
      sql: 'INSERT INTO sublessons (id, lesson_id, user_id, position, title, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, input.lesson_id, LOCAL_USER_ID, position, input.title, now()],
    })
    return id
  },

  async removeSublesson(id: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM sublessons WHERE id = ?', args: [id] })
  },

  async createPart(input: { sublesson_id: string }): Promise<string> {
    const id = newId()
    const position = await nextPosition('parts', 'position', 'sublesson')
    await turso.execute({
      sql: "INSERT INTO parts (id, sublesson_id, user_id, position, content, created_at) VALUES (?, ?, ?, ?, '[]', ?)",
      args: [id, input.sublesson_id, LOCAL_USER_ID, position, now()],
    })
    return id
  },

  async updatePart(id: string, content: string): Promise<void> {
    await turso.execute({
      sql: 'UPDATE parts SET content = ? WHERE id = ?',
      args: [content, id],
    })
  },

  async removePart(id: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM parts WHERE id = ?', args: [id] })
  },
}
