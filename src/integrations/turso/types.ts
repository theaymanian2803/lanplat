export type Language = 'Danish' | 'Japanese' | 'Spanish'

export interface Video {
  id: string
  user_id: string
  youtube_url: string
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
