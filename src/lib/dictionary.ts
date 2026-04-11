import type { Database } from "@/integrations/supabase/types";

type Language = Database["public"]["Enums"]["app_language"];

const DICTIONARY_URLS: Record<Language, (word: string) => string> = {
  Japanese: (w) => `https://jisho.org/search/${encodeURIComponent(w)}`,
  Spanish: (w) => `https://www.spanishdict.com/translate/${encodeURIComponent(w)}`,
  Danish: (w) => `https://www.ordbog.com/search?q=${encodeURIComponent(w)}`,
};

export function openDictionary(word: string, language: Language) {
  const url = DICTIONARY_URLS[language](word);
  window.open(url, "_blank", "noopener");
}
