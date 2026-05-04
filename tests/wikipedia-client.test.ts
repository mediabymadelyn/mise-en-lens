import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWikiContextForFilms } from "@/lib/wikipedia/client";

describe("fetchWikiContextForFilms — error handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns null for a film title when the Wikipedia API responds with a non-ok status", async () => {
    const title = `NonExistentFilmTestOnly_${Math.random()}`;
    const result = await fetchWikiContextForFilms([title]);
    expect(result.get(title)).toBeNull();
  });

  it("returns null for every film when all API responses fail", async () => {
    const titles = [
      `FilmAlpha_TestOnly_${Math.random()}`,
      `FilmBeta_TestOnly_${Math.random()}`,
    ];
    const result = await fetchWikiContextForFilms(titles);
    for (const t of titles) {
      expect(result.get(t)).toBeNull();
    }
  });

  it("returns a Map with keys for every film title passed in", async () => {
    const titles = [`FilmA_${Math.random()}`, `FilmB_${Math.random()}`];
    const result = await fetchWikiContextForFilms(titles);
    expect(result.size).toBe(titles.length);
    for (const t of titles) {
      expect(result.has(t)).toBe(true);
    }
  });
});
