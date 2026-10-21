const LANG_BADGE: Record<string, string> = {
  Danish: 'bg-[#d4552b]/15 text-[#e9a184] border-[#d4552b]/40',
  Japanese: 'bg-[#8a5a7a]/20 text-[#c79bb6] border-[#8a5a7a]/50',
  Spanish: 'bg-[#d19a2a]/15 text-[#e6c37a] border-[#d19a2a]/40',
  French: 'bg-[#2e6b63]/20 text-[#8fc4bc] border-[#2e6b63]/50',
  Swedish: 'bg-[#7a8f4f]/20 text-[#b8c98e] border-[#7a8f4f]/50',
}

const FALLBACK_BADGE = 'bg-[#8a8f7a]/15 text-[#c2c4b4] border-[#8a8f7a]/40'

const LANG_DOT: Record<string, string> = {
  Danish: 'bg-[#d4552b]',
  Japanese: 'bg-[#8a5a7a]',
  Spanish: 'bg-[#d19a2a]',
  French: 'bg-[#2e6b63]',
  Swedish: 'bg-[#7a8f4f]',
}

const FALLBACK_DOT = 'bg-[#8a8f7a]'

export const getLangBadgeClasses = (lang: string) => LANG_BADGE[lang] || FALLBACK_BADGE

export const getLangDotClass = (lang: string) => LANG_DOT[lang] || FALLBACK_DOT
