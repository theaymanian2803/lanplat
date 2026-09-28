import { useQuery } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { useMemo, useState } from 'react'

import { videosDb } from '@/integrations/turso/db'
import type { Video } from '@/integrations/turso/types'
import { extractVideoId, getThumbnailUrl } from '@/lib/youtube'
import { cn } from '@/lib/utils'

const VIDEOS_PER_LANGUAGE = 3

const EMBED_PARAMS = 'rel=0&modestbranding=1&playsinline=1&autoplay=1'

/**
 * The vault's own media, shown on the landing page by default — one full section per
 * language that has videos, three newest each. Renders nothing while the vault is empty.
 */
export const VaultVideos = () => {
  const [playingId, setPlayingId] = useState<string | null>(null)

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos', 'landing', 'all'],
    queryFn: () => videosDb.list(),
  })

  const byLanguage = useMemo(() => {
    const grouped = new Map<string, Video[]>()
    for (const video of videos) {
      if (video.media_type !== 'video') continue
      if (extractVideoId(video.youtube_url ?? '') === null) continue
      const rows = grouped.get(video.language) ?? []
      if (rows.length < VIDEOS_PER_LANGUAGE) {
        rows.push(video)
        grouped.set(video.language, rows)
      }
    }
    return [...grouped.entries()]
  }, [videos])

  if (!isLoading && byLanguage.length === 0) return null

  const cardClass =
    'overflow-hidden rounded-2xl border border-border/40 bg-card transition-colors'

  const renderCard = (video: Video, language: string) => {
    const videoId = extractVideoId(video.youtube_url ?? '')!
    const playing = playingId === video.id

    return playing ? (
      <div key={video.id} className={cn(cardClass, 'border-primary/30')}>
        <div className="aspect-video bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?${EMBED_PARAMS}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <p className="truncate p-4 text-sm font-medium">{video.title}</p>
      </div>
    ) : (
      <button
        key={video.id}
        type="button"
        onClick={() => setPlayingId(video.id)}
        aria-label={`Play ${video.title}`}
        className={cn(
          cardClass,
          'group w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:border-primary/30'
        )}>
        <div className="relative aspect-video bg-muted">
          <img
            src={getThumbnailUrl(videoId)}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-10 w-10 text-white" />
          </div>
        </div>
        <span className="block truncate p-4 text-sm font-medium">{video.title}</span>
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-16">
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section}>
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn(cardClass)}>
                  <div className="aspect-video animate-pulse bg-muted" />
                  <div className="p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {byLanguage.map(([language, rows]) => (
        <section
          key={language}
          id={`vault-videos-${language.toLowerCase().replace(/\s+/g, '-')}`}
          className="scroll-mt-20 border-t border-border/40 py-16">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Watch the vault
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {language}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The three newest videos banked for {language} — click any thumbnail to play it
            here.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((video) => renderCard(video, language))}
          </div>
        </section>
      ))}
    </>
  )
}