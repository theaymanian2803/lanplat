const LANG_CODES: Record<string, string> = {
  Danish: "da",
  Spanish: "es",
  Japanese: "ja",
  English: "en",
};

const TARGET = "en";
const TIMEOUT_MS = 8000;

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function langCode(language: string): string {
  return LANG_CODES[language] ?? "auto";
}

export function clearTranslateCache() {
  cache.clear();
  inflight.clear();
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isBlockPage(res: Response): boolean {
  const type = res.headers?.get?.("content-type") ?? "";
  return type.includes("text/html") || type.includes("sorry");
}

async function parseJson(res: Response): Promise<unknown> {
  if (!res.ok) throw new Error(`Translate request failed: ${res.status}`);
  if (isBlockPage(res)) throw new Error("Translate provider blocked the request");
  return res.json();
}

async function googleTranslate(word: string, from: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=dict-chrome-ex&sl=${from}&tl=${TARGET}&dt=t&q=${encodeURIComponent(word)}`;
  const res = await fetchWithTimeout(url);
  const data = (await parseJson(res)) as Array<Array<Array<unknown>>>;
  const translated = data?.[0]?.[0]?.[0];
  if (typeof translated !== "string" || !translated) {
    throw new Error("Google translate returned no result");
  }
  return translated;
}

async function myMemoryTranslate(word: string, from: string): Promise<string> {
  const email = import.meta.env.VITE_MYMEMORY_EMAIL as string | undefined;
  const de = email ? `&de=${encodeURIComponent(email)}` : "";
  const url =
    `https://api.mymemory.translated.net/get` +
    `?q=${encodeURIComponent(word)}&langpair=${encodeURIComponent(`${from}|${TARGET}`)}${de}`;
  const res = await fetchWithTimeout(url);
  const data = (await parseJson(res)) as {
    responseData?: { translatedText?: string };
    quotaFinished?: boolean;
    responseStatus?: number;
  };
  const translated = data.responseData?.translatedText;
  if (
    !translated ||
    data.quotaFinished ||
    translated.startsWith("MYMEMORY WARNING") ||
    data.responseStatus !== 200
  ) {
    throw new Error("MyMemory quota exceeded or no result");
  }
  return translated;
}

const providers = [googleTranslate, myMemoryTranslate];

export async function translateWord(word: string, language: string): Promise<string> {
  const key = `${language}:${word.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const from = langCode(language);
    const errors: string[] = [];
    for (const provider of providers) {
      try {
        const result = await provider(word, from);
        cache.set(key, result);
        return result;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw new Error(`Translation unavailable (${errors.join("; ")})`);
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
