const LANG_BADGE: Record<string, string> = {
  Danish: 'bg-red-500/15 text-red-300 border-red-500/30',
  Japanese: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  Spanish: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
}

const FALLBACK_BADGE = 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30'

const LANG_DOT: Record<string, string> = {
  Danish: 'bg-red-400',
  Japanese: 'bg-pink-400',
  Spanish: 'bg-orange-400',
}

const FALLBACK_DOT = 'bg-zinc-400'

export const getLangBadgeClasses = (lang: string) => LANG_BADGE[lang] || FALLBACK_BADGE

export const getLangDotClass = (lang: string) => LANG_DOT[lang] || FALLBACK_DOT