export type Language = 'Danish' | 'Japanese' | 'Spanish'

export interface Video {
  id: string
  user_id: string
  media_type: 'video' | 'text'
  youtube_url: string | null
  content: string | null
  title: string
  language: string
  created_at: string
}

export interface VocabWord {
  id: string
  user_id: string
  language: string
  word: string
  translation: string
  context_note: string | null
  created_at: string
  mastery_level: number
  next_review_date: string
}

export interface Note {
  id: string
  video_id: string
  user_id: string
  timestamp: number
  content: string
  created_at: string
}

export interface Screenshot {
  id: string
  video_id: string
  user_id: string
  timestamp: number
  image_url: string
  created_at: string
}

export type ContentBlockType = 'h1' | 'h2' | 'h3' | 'p' | 'table'

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface ContentBlock {
  id: string
  type: ContentBlockType
  text: string
  color: string
  table?: TableData
}

export interface Part {
  id: string
  lesson_id: string
  user_id: string
  position: number
  content: string
  created_at: string
}

export interface Lesson {
  id: string
  user_id: string
  media_type: 'video' | 'book' | null
  media_id: string | null
  title: string
  language: string | null
  created_at: string
}
