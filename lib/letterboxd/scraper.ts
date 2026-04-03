import { spawn } from "child_process";
import path from "path";

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
  const scriptPath = path.join(process.cwd(), "scripts", "scrape_top4.py");

  return new Promise<LetterboxdScrapeResult>((resolve) => {
    const child = spawn("python3", [scriptPath, input], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = 20000;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({
        ok: false,
        error: "Scraper timed out after 20 seconds.",
        films: [],
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        error: `Scraper failed to start: ${error.message}`,
        films: [],
      });
    });

    child.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const output = stdout.trim();
      if (!output) {
        resolve({
          ok: false,
          error: stderr.trim() || "Scraper returned no output.",
          films: [],
        });
        return;
      }

      try {
        const parsed = JSON.parse(output) as LetterboxdScrapeResult;
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          error: stderr.trim() || `Scraper returned invalid JSON: ${output.slice(0, 200)}`,
          films: [],
        });
      }
    });
  });
}
