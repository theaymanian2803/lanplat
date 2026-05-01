
# LingoVault — Language Learning Dashboard

## Overview
A single-user, dark-mode-by-default language learning dashboard for embedding YouTube videos, taking timestamped notes, uploading screenshots, and building a vocabulary bank. Authenticated via Google OAuth on Lovable Cloud.

## Design System
- **Dark mode by default** — cinematic, developer-focused aesthetic
- Heavy use of Shadcn UI: Cards, Badges, Tabs, ToggleGroup, Dialog, Table
- Minimal, focused layout with generous spacing

## Backend (Lovable Cloud / Supabase)

### Tables
- **videos**: id (uuid), youtube_url, title, language (enum: Danish, Japanese, Spanish), created_at
- **notes**: id, video_id (FK), timestamp (integer, seconds), content (text), created_at
- **screenshots**: id, video_id (FK), timestamp (integer), image_url (text), created_at
- **vocabulary**: id, language (enum), word, translation, context_note, created_at

### Storage
- A `screenshots` bucket for uploaded screenshot images

### Auth
- Google OAuth, single admin user

## Pages & Features

### 1. Dashboard (Home `/`)
- Grid of video Cards showing title, language badge, and thumbnail
- **Language filter bar** (ToggleGroup): All / Danish / Japanese / Spanish
- **Add Video input** at top: paste YouTube URL → dialog asks for title & language → saves to DB

### 2. Study Room (`/video/:id`)
- **Top**: Responsive YouTube iframe embed, controlled via YouTube IFrame API
- **Middle**: Two action buttons — "Add Note at Current Time" and "Upload Screenshot at Current Time"
  - "Add Note" opens a dialog pre-filled with the current video timestamp; user types note content
  - "Upload Screenshot" opens a file picker, uploads to Supabase Storage, records URL + timestamp
- **Bottom**: Two-column tabbed layout
  - **Notes tab**: Chronological list of notes; each shows a clickable timestamp Badge that seeks the video
  - **Screenshots tab**: Grid of uploaded screenshots with clickable timestamp badges

### 3. Vocab Bank (`/vocab`)
- Data table of all vocabulary entries (word, translation, language, context note)
- Search input + language filter dropdown
- "Add Word" button → dialog form

### 4. Layout
- Top navbar with LingoVault branding, nav links (Dashboard, Vocab Bank), and sign-out button
- All routes protected behind Google OAuth login

## Implementation Order
1. Set up Lovable Cloud: database tables, storage bucket, Google OAuth
2. Auth gate + dark theme + app layout/navbar
3. Dashboard page with video cards, language filter, and add-video flow
4. Study Room page with YouTube IFrame API integration, notes, and screenshot upload
5. Vocab Bank page with table, search, and add-word form
