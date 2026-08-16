import type { Language } from "@/integrations/turso/types";

const DICTIONARY_URLS: Partial<Record<Language, (word: string) => string>> = {
  Japanese: (w) => `https://jisho.org/search/${encodeURIComponent(w)}`,
  Spanish: (w) => `https://www.spanishdict.com/translate/${encodeURIComponent(w)}`,
  Danish: (w) => `https://www.ordbog.com/search?q=${encodeURIComponent(w)}`,
};

export function openDictionary(word: string, language: string) {
  const builder = DICTIONARY_URLS[language as Language];
  if (!builder) return;
  window.open(builder(word), "_blank", "noopener");
}
