import wiki from "wikipedia";

export type WikiFilmContext = {
  filmTitle: string;
  wikiTitle: string;
  extract: string;
  description: string | null;
  pageUrl: string;
};

const TIMEOUT_MS = 5000;
const MAX_EXTRACT_WORDS = 300;

function truncateExtract(text: string): string {
  const words = text.split(/\s+/);
  if (words.length <= MAX_EXTRACT_WORDS) {
    return text;
  }
  return words.slice(0, MAX_EXTRACT_WORDS).join(" ") + "...";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Wikipedia lookup timed out")), ms)
    ),
  ]);
}

async function fetchSingleFilm(
  filmTitle: string
): Promise<WikiFilmContext | null> {
  const queries = [`${filmTitle} (film)`, filmTitle];

  for (const query of queries) {
    try {
      const searchResults = await wiki.search(query);
      const firstTitle = searchResults.results[0]?.title;
      if (!firstTitle) continue;

      const page = await wiki.page(firstTitle);
      const summary = await page.summary();

      if (!summary.extract) continue;

      return {
        filmTitle,
        wikiTitle: summary.title,
        extract: truncateExtract(summary.extract),
        description: summary.description ?? null,
        pageUrl: page.fullurl,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function fetchWikiContextForFilms(
  filmTitles: string[]
): Promise<Map<string, WikiFilmContext | null>> {
  const results = await Promise.allSettled(
    filmTitles.map((title) =>
      withTimeout(fetchSingleFilm(title), TIMEOUT_MS).catch((error) => {
        console.warn(`Wikipedia lookup failed for "${title}":`, error);
        return null;
      })
    )
  );

  const contextMap = new Map<string, WikiFilmContext | null>();
  filmTitles.forEach((title, index) => {
    const result = results[index];
    contextMap.set(
      title,
      result.status === "fulfilled" ? result.value : null
    );
  });

  return contextMap;
}
