import { useCallback, useEffect, useRef, useState } from "react";
import { translateWord } from "@/lib/translate";

interface UseAutoTranslateOptions {
  delay?: number;
}

export function useAutoTranslate(
  word: string,
  language: string,
  translation: string,
  setTranslation: (t: string) => void,
  { delay = 600 }: UseAutoTranslateOptions = {}
) {
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const translationRef = useRef(translation);
  translationRef.current = translation;
  const userEditedRef = useRef(false);

  const markUserEdit = useCallback(() => {
    userEditedRef.current = true;
  }, []);

  useEffect(() => {
    if (!word.trim()) {
      setTranslating(false);
      setError(null);
      userEditedRef.current = false;
      if (translationRef.current) setTranslation("");
      return;
    }
    if (language === "English") {
      setTranslating(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      setTranslating(true);
      setError(null);
      translateWord(word.trim(), language)
        .then((t) => {
          if (cancelled) return;
          if (!translationRef.current.trim() || !userEditedRef.current) setTranslation(t);
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
  }, [word, language, setTranslation, delay]);

  return { translating, markUserEdit, error };
}