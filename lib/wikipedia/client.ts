export type WikiFilmContext = {
  filmTitle: string;
  wikiTitle: string;
  extract: string;
  description: string | null;
  pageUrl: string;
  plot: string | null;
  themes: string | null;
};

const TIMEOUT_MS = 8000;
const MAX_SECTION_WORDS = 500;
const USER_AGENT = "MiseEnLens/1.0 (film tutor app; contact: joelawalsh@gmail.com)";
const REST_BASE = "https://en.wikipedia.org/api/rest_v1";
const ACTION_BASE = "https://en.wikipedia.org/w/api.php";

const PLOT_NAMES = new Set(["plot", "synopsis", "plot summary"]);
const THEME_NAMES = new Set(["themes", "thematic analysis", "thematic content"]);

type WikiSummaryResponse = {
  title: string;
  extract: string;
  description?: string;
  content_urls?: {
    desktop?: { page?: string };
  };
};

type WikiSearchResponse = {
  query?: {
    search?: Array<{ title: string }>;
  };
};

type WikiSectionsResponse = {
  parse?: {
    sections?: Array<{ index: string; line: string; toclevel: number }>;
  };
};

type WikiSectionTextResponse = {
  parse?: {
    wikitext?: { "*": string };
  };
};

function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

function stripWikiMarkup(wikitext: string): string {
  return wikitext
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<ref[^/]*\/>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^==+.*==+$/gm, "")
    .replace(/^\|.*$/gm, "")
    .replace(/^\{.*$/gm, "")
    .replace(/^\}.*$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Wikipedia lookup timed out")), ms)
    ),
  ]);
}

async function apiFetch<T>(params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, format: "json" });
  const response = await fetch(`${ACTION_BASE}?${qs}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function searchWikipedia(query: string): Promise<string | null> {
  const data = await apiFetch<WikiSearchResponse>({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "1",
  });
  return data?.query?.search?.[0]?.title ?? null;
}

async function fetchSummary(
  pageTitle: string
): Promise<WikiSummaryResponse | null> {
  const encoded = encodeURIComponent(pageTitle.replace(/ /g, "_"));
  const response = await fetch(`${REST_BASE}/page/summary/${encoded}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) return null;
  return (await response.json()) as WikiSummaryResponse;
}

async function fetchSections(
  pageTitle: string
): Promise<Array<{ index: string; line: string }>> {
  const data = await apiFetch<WikiSectionsResponse>({
    action: "parse",
    page: pageTitle.replace(/ /g, "_"),
    prop: "sections",
  });
  return data?.parse?.sections ?? [];
}

async function fetchSectionText(
  pageTitle: string,
  sectionIndex: string
): Promise<string | null> {
  const data = await apiFetch<WikiSectionTextResponse>({
    action: "parse",
    page: pageTitle.replace(/ /g, "_"),
    prop: "wikitext",
    section: sectionIndex,
  });
  const raw = data?.parse?.wikitext?.["*"];
  if (!raw) return null;
  const plain = stripWikiMarkup(raw);
  return plain || null;
}

function findSectionIndex(
  sections: Array<{ index: string; line: string }>,
  names: Set<string>
): string | null {
  for (const s of sections) {
    if (names.has(s.line.toLowerCase())) return s.index;
  }
  return null;
}

async function fetchSingleFilm(
  filmTitle: string
): Promise<WikiFilmContext | null> {
  const queries = [`${filmTitle} (film)`, filmTitle];

  for (const query of queries) {
    try {
      const pageTitle = await searchWikipedia(query);
      if (!pageTitle) continue;

      const [summary, sections] = await Promise.all([
        fetchSummary(pageTitle),
        fetchSections(pageTitle),
      ]);

      if (!summary?.extract) continue;

      const plotIndex = findSectionIndex(sections, PLOT_NAMES);
      const themesIndex = findSectionIndex(sections, THEME_NAMES);

      const [plotRaw, themesRaw] = await Promise.all([
        plotIndex ? fetchSectionText(pageTitle, plotIndex) : null,
        themesIndex ? fetchSectionText(pageTitle, themesIndex) : null,
      ]);

      return {
        filmTitle,
        wikiTitle: summary.title,
        extract: summary.extract,
        description: summary.description ?? null,
        pageUrl:
          summary.content_urls?.desktop?.page ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`,
        plot: plotRaw ? truncateToWords(plotRaw, MAX_SECTION_WORDS) : null,
        themes: themesRaw ? truncateToWords(themesRaw, MAX_SECTION_WORDS) : null,
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
