export type LetterboxdFilm = {
  title: string;
  film_url: string | null;
  poster_url: string | null;
};

export type LetterboxdScrapeResult =
  | {
      ok: true;
      username: string;
      source_url: string;
      films: LetterboxdFilm[];
      warning?: string;
    }
  | {
      ok: false;
      username?: string;
      error: string;
      films: [];
      warning?: string;
    };

const RESERVED_PATHS = new Set([
  "film",
  "films",
  "list",
  "lists",
  "search",
  "activity",
  "signin",
  "sign-in",
  "pro",
  "about",
]);

const BASE_URL = "https://letterboxd.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function cleanTitle(rawTitle: string): string {
  return decodeHtmlEntities(rawTitle)
    .trim()
    .replace(/^Poster\s+for\s+/i, "")
    .replace(/\s+\(.*poster.*\)$/i, "")
    .trim();
}

function absolutizeUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("/")) {
    return `${BASE_URL}${url}`;
  }

  return url;
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([\w:-]+)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/g;

  for (const match of tag.matchAll(attributePattern)) {
    const key = match[1];
    const rawValue = match[2];

    if (!rawValue) {
      attributes[key] = "";
      continue;
    }

    attributes[key] = decodeHtmlEntities(rawValue.replace(/^['"]|['"]$/g, ""));
  }

  return attributes;
}

function extractTagAttribute(tag: string, attribute: string): string | null {
  const attributes = parseAttributes(tag);
  return attributes[attribute] ?? null;
}

function extractFirstTag(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[0] ?? null;
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout);
  });
}

function extractFavoritesFromMetaDescription(html: string): LetterboxdFilm[] {
  const metaMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);

  const description = decodeHtmlEntities(metaMatch?.[1] ?? "").trim();
  if (!description.includes("Favorites:")) {
    return [];
  }

  const match = description.match(/Favorites:\s*(.+?)(?:\.|$)/i);
  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((entry) => cleanTitle(entry))
    .filter(Boolean)
    .slice(0, 4)
    .map((title) => ({
      title,
      film_url: null,
      poster_url: null,
    }));
}

function parseTop4FromProfileHtml(html: string): LetterboxdFilm[] {
  const films: LetterboxdFilm[] = [];
  const seenTitles = new Set<string>();

  const lazyPosterPattern = /<div[^>]*data-component-class=["']LazyPoster["'][^>]*>[\s\S]*?<\/div>/gi;
  for (const posterMatch of html.matchAll(lazyPosterPattern)) {
    const poster = posterMatch[0];
    const title = cleanTitle(
      extractTagAttribute(poster, "data-item-name") ??
        extractTagAttribute(poster, "data-item-full-display-name") ??
        ""
    );

    if (!title) {
      continue;
    }

    const normalized = title.toLowerCase();
    if (seenTitles.has(normalized)) {
      continue;
    }

    seenTitles.add(normalized);

    const imgTag = extractFirstTag(poster, /<img\b[^>]*>/i);
    const filmUrl = absolutizeUrl(
      extractTagAttribute(poster, "data-item-link") ??
        extractTagAttribute(poster, "data-target-link") ??
        extractTagAttribute(poster, "data-details-endpoint")?.replace("/json/", "/") ??
        null
    );

    const posterUrl = absolutizeUrl(
      extractTagAttribute(poster, "data-poster-url") ??
        (imgTag
          ? extractTagAttribute(imgTag, "src") ??
            extractTagAttribute(imgTag, "data-src") ??
            extractTagAttribute(imgTag, "srcset")?.split(" ")[0] ??
            null
          : null)
    );

    films.push({ title, film_url: filmUrl, poster_url: posterUrl });
    if (films.length === 4) {
      return films;
    }
  }

  const candidatePattern = /<li[^>]*class=["'][^"']*poster-container[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  for (const candidateMatch of html.matchAll(candidatePattern)) {
    const candidate = candidateMatch[1] ?? "";
    const linkTag = extractFirstTag(candidate, /<a\b[^>]*href=["'][^"']*\/film\/[^"]*["'][^>]*>/i);
    const imgTag = extractFirstTag(candidate, /<img\b[^>]*>/i);

    const rawTitle =
      (imgTag ? extractTagAttribute(imgTag, "alt") : null) ??
      (linkTag ? extractTagAttribute(linkTag, "title") : null) ??
      "";
    const title = cleanTitle(rawTitle);

    if (!title) {
      continue;
    }

    const normalized = title.toLowerCase();
    if (seenTitles.has(normalized)) {
      continue;
    }

    seenTitles.add(normalized);

    films.push({
      title,
      film_url: linkTag ? absolutizeUrl(extractTagAttribute(linkTag, "href")) : null,
      poster_url: imgTag
        ? absolutizeUrl(
            extractTagAttribute(imgTag, "src") ??
              extractTagAttribute(imgTag, "data-src") ??
              extractTagAttribute(imgTag, "srcset")?.split(" ")[0] ??
              null
          )
        : null,
    });

    if (films.length === 4) {
      return films;
    }
  }

  if (films.length > 0) {
    return films;
  }

  return extractFavoritesFromMetaDescription(html);
}

async function resolveDirectPosterUrl(filmUrl: string | null, timeoutMs: number): Promise<string | null> {
  if (!filmUrl) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(filmUrl, timeoutMs);
    if (response.status >= 400) {
      return null;
    }

    const html = await response.text();

    for (const scriptMatch of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      const rawText = (scriptMatch[1] ?? "").trim();
      if (!rawText) {
        continue;
      }

      const cleaned = rawText
        .replace(/^\/\*\s*<!\[CDATA\[\s*\*\//, "")
        .replace(/\/\*\s*\]\]>\s*\*\/$/, "")
        .trim();

      try {
        const payload = JSON.parse(cleaned) as unknown;
        const entries = Array.isArray(payload) ? payload : [payload];

        for (const entry of entries) {
          if (!entry || typeof entry !== "object") {
            continue;
          }

          const image = (entry as { image?: unknown }).image;
          if (typeof image === "string" && image) {
            return absolutizeUrl(image);
          }
        }
      } catch {
        continue;
      }
    }

    const ogImage =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ??
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
    if (ogImage?.[1]) {
      return absolutizeUrl(decodeHtmlEntities(ogImage[1]));
    }

    const twitterImage =
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ??
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["'][^>]*>/i);
    if (twitterImage?.[1]) {
      return absolutizeUrl(decodeHtmlEntities(twitterImage[1]));
    }
  } catch {
    return null;
  }

  return null;
}

export function parseLetterboxdInput(input?: string): string {
  const candidate = input?.trim();
  if (!candidate) {
    throw new Error("Username or Letterboxd URL is required.");
  }

  if (/^https?:\/\//i.test(candidate)) {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (hostname === "boxd.it") {
      throw new Error("Short Letterboxd URLs are not supported in this workspace.");
    }

    if (hostname !== "letterboxd.com") {
      throw new Error("Invalid Letterboxd URL. Use letterboxd.com or boxd.it.");
    }

    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
    if (!firstSegment || RESERVED_PATHS.has(firstSegment.toLowerCase())) {
      throw new Error("Could not find a Letterboxd profile username in the provided URL.");
    }

    return firstSegment;
  }

  const cleaned = candidate.replace(/^@/, "").replace(/\/+$/, "");
  if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    throw new Error("Invalid username. Use only letters, numbers, underscores, and hyphens.");
  }

  return cleaned;
}

export async function runLetterboxdScraper(input: string): Promise<LetterboxdScrapeResult> {
  const username = parseLetterboxdInput(input);
  const profileUrl = `${BASE_URL}/${username}/`;

  let response: Response;
  try {
    response = await fetchWithTimeout(profileUrl, 20000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return {
      ok: false,
      username,
      error: `Request failed: ${message}`,
      films: [],
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      username,
      error: "Profile not found (404). Check the username.",
      films: [],
    };
  }

  if (response.status >= 400) {
    return {
      ok: false,
      username,
      error: `Letterboxd returned status ${response.status}.`,
      films: [],
    };
  }

  const html = await response.text();
  const films = parseTop4FromProfileHtml(html);

  if (!films.length) {
    const lowerHtml = html.toLowerCase();
    if (
      lowerHtml.includes("don't forget to select your favorite films") ||
      lowerHtml.includes("don’t forget to select your favorite films")
    ) {
      return {
        ok: false,
        username,
        error: "This user has not set a Top 4 yet.",
        films: [],
      };
    }

    if (lowerHtml.includes("this profile is private") || lowerHtml.includes("members only")) {
      return {
        ok: false,
        username,
        error: "This profile is private or requires sign-in.",
        films: [],
      };
    }

    return {
      ok: false,
      username,
      error: "No Top 4 films found. The profile may be private or page markup changed.",
      films: [],
    };
  }

  const result: LetterboxdScrapeResult = {
    ok: true,
    username,
    source_url: profileUrl,
    films: [],
  };

  for (const film of films) {
    const directPoster = await resolveDirectPosterUrl(film.film_url, 8000);
    if (directPoster) {
      film.poster_url = directPoster;
    }

    result.films.push(film);
  }

  if (films.length < 4) {
    result.warning = `Only found ${films.length} favorites.`;
  }

  return result;
}
