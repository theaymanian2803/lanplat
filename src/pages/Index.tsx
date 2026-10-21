import Layout from '@/components/Layout'
import LanguageSelect from '@/components/LanguageSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { languagesDb, videosDb, vocabularyDb } from '@/integrations/turso/db'
import { BOOK_LANGUAGES } from '@/lib/bookCatalog'
import { getLangBadgeClasses, getLangDotClass } from '@/lib/langColors'
import { getTargetLanguage } from '@/lib/targetLanguage'
import { extractVideoId, getThumbnailUrl } from '@/lib/youtube'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, FileText, Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

type Language = string
type AddMode = 'choose' | 'video' | 'text'

const TICK_COLORS: Record<string, string> = {
  Danish: '#d4552b',
  Spanish: '#d19a2a',
  French: '#2e6b63',
  Swedish: '#7a8f4f',
}

const relativeTime = (iso: string) => {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const Index = () => {
  const queryClient = useQueryClient()
  const now = useMemo(() => new Date(), [])
  const nowIso = useMemo(() => now.toISOString(), [now])
  const startOfToday = useMemo(() => {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }, [now])

  const [filter, setFilter] = useState<string>(() => getTargetLanguage() ?? 'all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'text'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>('choose')
  const [newUrl, setNewUrl] = useState('')
  const [newText, setNewText] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newLang, setNewLang] = useState<Language>('')

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos', filter],
    queryFn: async () => videosDb.list(filter === 'all' ? undefined : filter),
  })

  const { data: allVideos = [] } = useQuery({
    queryKey: ['videos', 'all'],
    queryFn: () => videosDb.list(),
  })

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesDb.list,
  })

  const { data: dueWords = [] } = useQuery({
    queryKey: ['vocabulary', 'due'],
    queryFn: () => vocabularyDb.listDue(nowIso),
  })

  const { data: allWords = [] } = useQuery({
    queryKey: ['vocabulary', 'all'],
    queryFn: () => vocabularyDb.list(),
  })

  const visibleVideos = useMemo(
    () => videos.filter((v) => typeFilter === 'all' || v.media_type === typeFilter),
    [videos, typeFilter],
  )

  const overdue = dueWords.filter(
    (word) => new Date(word.next_review_date) < startOfToday,
  ).length
  const later = allWords.filter((word) => new Date(word.next_review_date) > now).length

  const dueByLanguage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const word of dueWords) {
      counts.set(word.language, (counts.get(word.language) ?? 0) + 1)
    }
    return counts
  }, [dueWords])

  const current = useMemo(() => {
    if (dueWords.length > 0) return dueWords[0]
    return [...allWords].sort(
      (a, b) => new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime(),
    )[0]
  }, [dueWords, allWords])

  const recent = allWords.slice(0, 3)
  const latest = allVideos[0]
  const latestVideoId = latest ? extractVideoId(latest.youtube_url ?? '') : null

  const day = 24 * 60 * 60 * 1000
  const dates = allWords.map((word) => new Date(word.next_review_date).getTime())
  const earliest = dates.length > 0 ? dates.reduce((a, b) => Math.min(a, b)) : now.getTime() - day
  const latestDate = dates.length > 0 ? dates.reduce((a, b) => Math.max(a, b)) : now.getTime() + 2 * day
  const tapeStart = Math.min(now.getTime() - 6 * 60 * 60 * 1000, earliest) - day / 4
  const tapeEnd = Math.max(now.getTime() + day, latestDate) + day / 4
  const tapeSpan = Math.max(tapeEnd - tapeStart, 60 * 60 * 1000)
  const nowPercent = ((now.getTime() - tapeStart) / tapeSpan) * 100

  const ticks = useMemo(() => {
    return allWords
      .map((word) => {
        const at = new Date(word.next_review_date).getTime()
        return { word, at }
      })
      .filter(({ at }) => at >= tapeStart && at <= tapeEnd)
      .slice(0, 64)
      .map(({ word, at }) => {
        const percent = Math.min(99, Math.max(1, ((at - tapeStart) / tapeSpan) * 100))
        const isOverdue = at < now.getTime()
        return {
          key: word.id,
          left: percent,
          color: isOverdue && new Date(word.next_review_date) < startOfToday
            ? '#b83226'
            : TICK_COLORS[word.language] ?? '#9a9d86',
          height: 14 + Math.min(5, word.mastery_level) * 4,
          dim: at > now.getTime(),
        }
      })
  }, [allWords, tapeStart, tapeSpan, tapeEnd, now, startOfToday])

  const targetName = filter !== 'all' ? filter : getTargetLanguage() ?? 'French'
  const bookLanguage =
    BOOK_LANGUAGES.find((language) => language.name === targetName) ?? BOOK_LANGUAGES[0]

  const addVideo = useMutation({
    mutationFn: async () => {
      const videoId = extractVideoId(newUrl)
      if (!videoId) throw new Error('Invalid YouTube URL')
      await videosDb.insert({
        media_type: 'video',
        youtube_url: newUrl,
        title: newTitle,
        language: newLang,
        content: null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      setDialogOpen(false)
      setAddMode('choose')
      setNewUrl('')
      setNewTitle('')
      toast.success('Video added')
    },
    onError: (e) => toast.error(e.message),
  })

  const addText = useMutation({
    mutationFn: async () => {
      const content = newText.trim()
      if (!content) throw new Error('Text content is required')
      await videosDb.insert({
        media_type: 'text',
        youtube_url: null,
        title: newTitle.trim(),
        language: newLang,
        content,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      setDialogOpen(false)
      setAddMode('choose')
      setNewText('')
      setNewTitle('')
      toast.success('Text added')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteVideo = useMutation({
    mutationFn: async (id: string) => {
      await videosDb.remove(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      toast.success('Video removed')
    },
  })

  const openAdd = () => {
    setAddMode('choose')
    setDialogOpen(true)
  }

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .format(now)
    .toUpperCase()

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <h2 className="sr-only">Dashboard</h2>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono-label text-muted-foreground">{dateLabel}</p>
            <h1
              data-tour="dashboard-heading"
              className="mt-1 text-[30px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[34px]">
              {greeting}.{' '}
              {dueWords.length > 0
                ? `${dueWords.length} ${dueWords.length === 1 ? 'word is' : 'words are'} due.`
                : 'Nothing is due.'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {languages.map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => setFilter(language)}
                aria-pressed={filter === language}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs transition-colors ${
                  filter === language
                    ? 'border-primary bg-primary/15 text-foreground'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${getLangDotClass(language)}`} />
                {language}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {dueByLanguage.get(language) ?? 0}
                </span>
              </button>
            ))}
            <Button onClick={openAdd} className="gap-2 text-sm font-semibold" data-tour="add-video">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        <section className="panel-enamel rounded-sm px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold tracking-[-0.02em]">Review tape</h2>
              <p className="mono-label mt-1 text-ink/75">
                Tick position = review time · colour = language
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex gap-6">
                <div>
                  <b className="block text-2xl font-extrabold leading-none">{dueWords.length}</b>
                  <span className="mono-label text-ink/75">Due</span>
                </div>
                <div>
                  <b className="block text-2xl font-extrabold leading-none">{overdue}</b>
                  <span className="mono-label text-ink/75">Overdue</span>
                </div>
                <div>
                  <b className="block text-2xl font-extrabold leading-none">{later}</b>
                  <span className="mono-label text-ink/75">Later</span>
                </div>
              </div>
              <Button asChild className="bg-primary font-semibold text-primary-foreground">
                <Link to="/quiz">Start review →</Link>
              </Button>
            </div>
          </div>

          <div className="relative mt-3 h-24 overflow-hidden rounded-sm bg-[#20241d]">
            {[12, 25, 38, 51, 64, 76, 89].map((left) => (
              <span
                key={left}
                className="absolute inset-y-0 w-px bg-white/10"
                style={{ left: `${left}%` }}
              />
            ))}
            {ticks.map((tick) => (
              <span
                key={tick.key}
                className="absolute bottom-3 w-[3px] rounded-sm"
                style={{
                  left: `${tick.left}%`,
                  height: `${tick.height}px`,
                  backgroundColor: tick.color,
                  opacity: tick.dim ? 0.45 : 1,
                }}
              />
            ))}
            <span
              className="absolute inset-y-0 w-px bg-primary"
              style={{ left: `${nowPercent}%` }}>
              <span className="mono-label absolute left-2 top-2 text-primary">Now</span>
            </span>
            {allWords.length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-enamel/70">
                No words saved yet. Capture one from a video, a book, or the translator.
              </p>
            ) : null}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.45fr_.85fr]">
          <div className="space-y-4">
            <section className="rounded-sm border border-border bg-card p-4">
              <h2 className="mono-label text-muted-foreground">Now in the carrel</h2>
              {latest ? (
                <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                  <Link
                    to={`/video/${latest.id}`}
                    className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-sm bg-muted sm:w-44">
                    {latestVideoId ? (
                      <img
                        src={getThumbnailUrl(latestVideoId)}
                        alt={latest.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${getLangBadgeClasses(latest.language)}`}>
                        {latest.language}
                      </Badge>
                      <span className="mono-label text-muted-foreground">
                        {latest.media_type === 'video' ? 'Video' : 'Text'}
                      </span>
                    </div>
                    <Link
                      to={`/video/${latest.id}`}
                      className="mt-2 block text-lg font-bold leading-tight tracking-[-0.02em] hover:text-primary">
                      {latest.title}
                    </Link>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {latest.media_type === 'text'
                        ? latest.content
                        : 'Open the study room to watch, pause and capture words from the subtitles.'}
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
                      <Link to={`/video/${latest.id}`}>
                        <Play className="h-3.5 w-3.5" />
                        {latest.media_type === 'video' ? 'Resume' : 'Read'}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-col items-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    No video or text yet. Add one to start a study room.
                  </p>
                  <Button variant="outline" size="sm" onClick={openAdd} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Add media
                  </Button>
                </div>
              )}
            </section>

            <section className="rounded-sm border border-border bg-card p-4">
              <h2 className="mono-label text-muted-foreground">Open book</h2>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex h-24 w-16 items-end rounded-sm bg-tape p-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white">
                  Shelf
                </div>
                <div>
                  <p className="text-lg font-bold tracking-[-0.02em]">
                    {bookLanguage.name} shelf
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Public-domain books from Project Gutenberg, five at a time.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5">
                    <Link to="/books">
                      <BookOpen className="h-3.5 w-3.5" />
                      Browse the shelf
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="panel-enamel rounded-sm p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="mono-label text-ink/75">Next up</h2>
                <span className="mono-label text-ink/70">
                  {dueWords.length > 0 ? `01 of ${dueWords.length}` : '—'}
                </span>
              </div>
              {current ? (
                <>
                  <p
                    className={`mt-2 break-words font-extrabold leading-[0.95] tracking-[-0.04em] ${
                      current.word.length > 26
                        ? 'text-[clamp(1.5rem,2.6vw,2.2rem)]'
                        : 'text-[clamp(2rem,4vw,3.4rem)]'
                    }`}>
                    {current.word}
                  </p>
                  <p className="mt-1 text-lg text-ink/65">{current.translation}</p>
                  {current.context_note ? (
                    <p className="mt-3 border-t border-ink/15 pt-2 text-sm text-ink/70">
                      {current.context_note}
                    </p>
                  ) : null}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-3 border-ink/25 bg-transparent text-ink hover:bg-ink/10 hover:text-ink">
                    <Link to="/quiz">Review this word</Link>
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink/70">
                  Nothing due. Capture a word to start the next cycle.
                </p>
              )}
            </section>

            <section className="rounded-sm border border-border bg-card p-4">
              <h2 className="mono-label text-muted-foreground">Recent captures</h2>
              {recent.length > 0 ? (
                <ul className="mt-2 divide-y divide-border">
                  {recent.map((word) => (
                    <li key={word.id} className="grid grid-cols-[1fr_auto] gap-x-3 py-2">
                      <span className="truncate text-sm font-semibold">{word.word}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {relativeTime(word.created_at)}
                      </span>
                      <span className="col-span-2 truncate text-xs text-muted-foreground">
                        {word.translation} · {word.language}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No words yet. Translate one or select it in a book.
                </p>
              )}
            </section>
          </div>
        </div>

        <section id="library" className="scroll-mt-6 border-t border-border pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.025em]">Video &amp; text library</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {visibleVideos.length} {visibleVideos.length === 1 ? 'item' : 'items'} ·{' '}
                {filter === 'all' ? 'all languages' : filter}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as 'all' | 'video' | 'text')}>
                <SelectTrigger aria-label="Media type" className="h-9 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All media</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="text">Texts</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger aria-label="Library language" className="h-9 w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All languages</SelectItem>
                  {languages.map((language) => (
                    <SelectItem key={language} value={language}>
                      {language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-3 divide-y divide-border border-y border-border">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-4 py-3">
                  <div className="h-14 w-24 animate-pulse rounded-sm bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleVideos.length === 0 ? (
            <div className="mt-3 border-y border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {allVideos.length === 0
                  ? 'No media yet. Add a video or a text to start.'
                  : typeFilter === 'video'
                    ? 'No videos in this language.'
                    : typeFilter === 'text'
                      ? 'No texts in this language.'
                      : 'No media in this language.'}
              </p>
              <Button variant="outline" size="sm" onClick={openAdd} className="mt-3 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add media
              </Button>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {visibleVideos.map((video) => {
                const videoId = extractVideoId(video.youtube_url ?? '')
                return (
                  <li
                    key={video.id}
                    className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3">
                    <Link
                      to={`/video/${video.id}`}
                      className="relative block h-14 w-24 shrink-0 overflow-hidden rounded-sm bg-muted">
                      {videoId ? (
                        <img
                          src={getThumbnailUrl(videoId)}
                          alt={video.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono-label text-muted-foreground">
                          {video.media_type === 'video' ? 'Video' : 'Text'}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${getLangBadgeClasses(video.language)}`}>
                          {video.language}
                        </Badge>
                        <span className="mono-label text-muted-foreground">
                          {relativeTime(video.created_at)}
                        </span>
                      </div>
                      <Link
                        to={`/video/${video.id}`}
                        className="mt-1 block truncate text-base font-semibold tracking-[-0.01em] hover:text-primary">
                        {video.title}
                      </Link>
                    </div>
                    <div className="ml-4 border-l border-border pl-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${video.title}`}
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        onClick={() => deleteVideo.mutate(video.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setAddMode('choose')
        }}>
        <DialogContent>
          {addMode === 'choose' ? (
            <>
              <DialogHeader>
                <DialogTitle>Add media</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-28 flex-col gap-2 text-sm font-semibold"
                  onClick={() => setAddMode('video')}>
                  <Play className="h-6 w-6 text-primary" />
                  Add Video
                </Button>
                <Button
                  variant="outline"
                  className="h-28 flex-col gap-2 text-sm font-semibold"
                  onClick={() => setAddMode('text')}>
                  <FileText className="h-6 w-6 text-primary" />
                  Add Text
                </Button>
              </div>
            </>
          ) : addMode === 'video' ? (
            <>
              <DialogHeader>
                <DialogTitle>Add YouTube video</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>YouTube URL</Label>
                  <Input
                    placeholder="https://youtube.com/watch?v=..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="Video title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-video-language">Language</Label>
                  <LanguageSelect
                    id="add-video-language"
                    languages={languages}
                    value={newLang}
                    onChange={setNewLang}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setAddMode('choose')} className="text-sm">
                  Back
                </Button>
                <Button
                  onClick={() => addVideo.mutate()}
                  disabled={!newUrl || !newTitle || !newLang || addVideo.isPending}
                  className="text-sm font-semibold">
                  {addVideo.isPending ? 'Saving…' : 'Add Video'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add text</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Chapter 1 — The Journey"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-text-language">Language</Label>
                  <LanguageSelect
                    id="add-text-language"
                    languages={languages}
                    value={newLang}
                    onChange={setNewLang}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Text content</Label>
                  <Textarea
                    placeholder="Paste the full text here…"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    className="min-h-[200px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setAddMode('choose')} className="text-sm">
                  Back
                </Button>
                <Button
                  onClick={() => addText.mutate()}
                  disabled={!newTitle.trim() || !newText.trim() || addText.isPending}
                  className="text-sm font-semibold">
                  {addText.isPending ? 'Saving…' : 'Add Text'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default Index
