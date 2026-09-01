import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import { clearTranslateCache } from "@/lib/translate";

const googleResponse = [
  [["dog", "hund", null, null, 10]],
  null,
  "da",
];

const phraseGoogleResponse = [
  [["dog and cat", "hund og kat", null, null, 10]],
  null,
  "da",
];

interface Props {
  w: string;
  t: string;
}

function renderAutoTranslate(setTranslation: ReturnType<typeof vi.fn>, initial: Props = { w: "hund", t: "" }) {
  return renderHook(
    ({ w, t }: Props) => useAutoTranslate(w, "Danish", t, setTranslation, { delay: 0 }),
    { initialProps: initial }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearTranslateCache();
});

describe("useAutoTranslate", () => {
  it("auto-fills the translation after the debounce when the field is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => googleResponse }));
    const setTranslation = vi.fn();

    renderAutoTranslate(setTranslation);

    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith("dog"));
  });

  it("updates the auto-filled translation as the word grows into a phrase", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => googleResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => phraseGoogleResponse });
    vi.stubGlobal("fetch", fn);
    const setTranslation = vi.fn();

    const { rerender } = renderAutoTranslate(setTranslation);
    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith("dog"));

    rerender({ w: "hund og kat", t: "dog" });

    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith("dog and cat"));
  });

  it("clears the translation when the word is deleted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => googleResponse }));
    const setTranslation = vi.fn();

    const { rerender } = renderAutoTranslate(setTranslation);
    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith("dog"));

    rerender({ w: "", t: "dog" });

    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith(""));
  });

  it("does not overwrite a manually typed translation", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => googleResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => phraseGoogleResponse });
    vi.stubGlobal("fetch", fn);
    const setTranslation = vi.fn();

    const { rerender, result } = renderAutoTranslate(setTranslation);
    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith("dog"));

    result.current.markUserEdit();
    rerender({ w: "hund og kat", t: "my own translation" });

    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(setTranslation).toHaveBeenCalledTimes(1);
  });

  it("resumes auto-fill after the user clears their manual translation", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => googleResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => phraseGoogleResponse });
    vi.stubGlobal("fetch", fn);
    const setTranslation = vi.fn();

    const { rerender, result } = renderAutoTranslate(setTranslation);
    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith("dog"));

    result.current.markUserEdit();
    rerender({ w: "hund", t: "cleared" });
    rerender({ w: "hund og kat", t: "" });

    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith("dog and cat"));
  });

  it("does not fill the field when translation fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const setTranslation = vi.fn();

    renderAutoTranslate(setTranslation);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(setTranslation).not.toHaveBeenCalled();
  });

  it("surfaces an error when translation fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const setTranslation = vi.fn();

    const { result } = renderAutoTranslate(setTranslation);

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.translating).toBe(false);
  });

  it("clears the error once translation succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true, json: async () => phraseGoogleResponse });
    vi.stubGlobal("fetch", fn);
    const setTranslation = vi.fn();

    const { rerender, result } = renderAutoTranslate(setTranslation);
    await waitFor(() => expect(result.current.error).toBeTruthy());

    rerender({ w: "hund og kat", t: "" });
    await waitFor(() => expect(setTranslation).toHaveBeenCalledWith("dog and cat"));
    expect(result.current.error).toBeNull();
  });

  it("skips translation when the word language is English", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    const setTranslation = vi.fn();

    renderHook(() =>
      useAutoTranslate("dog", "English", "", setTranslation, { delay: 0 })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(setTranslation).not.toHaveBeenCalled();
  });
});