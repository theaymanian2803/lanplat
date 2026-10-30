import { useCallback, useEffect, useRef, useState } from "react";
import { translateWord } from "@/lib/translate";

interface UseAutoTranslateOptions {
  delay?: number;
  /** Language to translate into. Defaults to English. */
  to?: string;
}

export function useAutoTranslate(
  word: string,
  language: string,
  translation: string,
  setTranslation: (t: string) => void,
  { delay = 600, to = "English" }: UseAutoTranslateOptions = {}
) {
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const translationRef = useRef(translation);
  translationRef.current = translation;
  const userEditedRef = useRef(false);
  const lastTargetRef = useRef(to);

  const markUserEdit = useCallback(() => {
    userEditedRef.current = true;
  }, []);

  useEffect(() => {
    // Switching the target language is an explicit request for a fresh translation,
    // so it overrides a manual edit and resets the manual-edit latch.
    const targetChanged = lastTargetRef.current !== to;
    lastTargetRef.current = to;

    if (!word.trim()) {
      setTranslating(false);
      setError(null);
      userEditedRef.current = false;
      if (translationRef.current) setTranslation("");
      return;
    }
    if (language === to) {
      setTranslating(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      setTranslating(true);
      setError(null);
      translateWord(word.trim(), language, to)
        .then((t) => {
          if (cancelled) return;
          if (targetChanged || !translationRef.current.trim() || !userEditedRef.current) {
            setTranslation(t);
            userEditedRef.current = false;
          }
        })
        .catch(() => {
          if (!cancelled) setError("Auto-translate is unavailable right now");
        })
        .finally(() => {
          if (!cancelled) setTranslating(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(handle);
      setTranslating(false);
      setError(null);
    };
  }, [word, language, setTranslation, delay, to]);

  return { translating, markUserEdit, error };
}