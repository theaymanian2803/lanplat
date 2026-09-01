import { afterEach, describe, expect, it, vi } from "vitest";
import { langCode, translateWord, clearTranslateCache } from "@/lib/translate";

const googleResponse = [
  [["dog", "hund", null, null, 10]],
  null,
  "da",
  null,
  null,
  null,
  null,
  [],
];

const myMemoryResponse = {
  responseData: { translatedText: "dog", match: 1 },
  quotaFinished: false,
  responseStatus: 200,
};

function stubFetch(response: unknown) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function stubFetchSequence(...responses: unknown[]) {
  const fn = vi.fn().mockImplementation(async (url: string) => {
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearTranslateCache();
});

describe("langCode", () => {
  it("maps known language names to ISO codes", () => {
    expect(langCode("Danish")).toBe("da");
    expect(langCode("Spanish")).toBe("es");
    expect(langCode("Japanese")).toBe("ja");
  });

  it("defaults to auto for unknown languages", () => {
    expect(langCode("Klingon")).toBe("auto");
  });
});

describe("translateWord", () => {
  it("returns the Google translation for a word", async () => {
    stubFetch({ ok: true, json: async () => googleResponse });

    await expect(translateWord("hund", "Danish")).resolves.toBe("dog");
  });

  it("falls back to MyMemory when Google fails", async () => {
    const fn = stubFetchSequence(
      new Error("network down"),
      { ok: true, json: async () => myMemoryResponse }
    );

    await expect(translateWord("hund", "Danish")).resolves.toBe("dog");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back to MyMemory when Google returns an empty result", async () => {
    const fn = stubFetchSequence(
      { ok: true, json: async () => [[], null, "da"] },
      { ok: true, json: async () => myMemoryResponse }
    );

    await expect(translateWord("hund", "Danish")).resolves.toBe("dog");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back to MyMemory when Google returns a block page instead of JSON", async () => {
    const htmlPage = "<html>Sorry... automated queries</html>";
    const fn = stubFetchSequence(
      {
        ok: true,
        headers: { get: () => "text/html" },
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        },
      },
      { ok: true, json: async () => myMemoryResponse }
    );

    await expect(translateWord("hund", "Danish")).resolves.toBe("dog");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back to MyMemory when Google fails with an HTTP error", async () => {
    const fn = stubFetchSequence(
      { ok: false, status: 429, json: async () => ({}) },
      { ok: true, json: async () => myMemoryResponse }
    );

    await expect(translateWord("hund", "Danish")).resolves.toBe("dog");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses Google when MyMemory has exhausted its quota", async () => {
    const fn = stubFetchSequence(
      { ok: true, json: async () => googleResponse },
      { ok: true, json: async () => ({ quotaFinished: true }) }
    );

    await expect(translateWord("hund", "Danish")).resolves.toBe("dog");
  });

  it("treats MyMemory quota warnings as a failure and retries Google", async () => {
    const fn = stubFetchSequence(
      { ok: true, json: async () => googleResponse },
      {
        ok: true,
        json: async () => ({
          responseData: {
            translatedText:
              "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY",
          },
          quotaFinished: true,
        }),
      }
    );

    await expect(translateWord("hund", "Danish")).resolves.toBe("dog");
  });

  it("deduplicates concurrent calls for the same word", async () => {
    const fn = stubFetch({ ok: true, json: async () => googleResponse });

    const results = await Promise.all([
      translateWord("hund", "Danish"),
      translateWord("hund", "Danish"),
      translateWord("hund", "Danish"),
    ]);

    expect(results).toEqual(["dog", "dog", "dog"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws when both providers fail", async () => {
    stubFetch(new Error("network down"));

    await expect(translateWord("hund", "Danish")).rejects.toThrow();
  });

  it("caches results and does not refetch the same word", async () => {
    const fn = stubFetch({ ok: true, json: async () => googleResponse });

    await translateWord("hund", "Danish");
    await translateWord("hund", "Danish");

    expect(fn).toHaveBeenCalledTimes(1);
  });
});