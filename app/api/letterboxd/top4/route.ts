import { parseLetterboxdInput, runLetterboxdScraper } from "@/lib/letterboxd/scraper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; input?: string };
    const profileInput = parseLetterboxdInput(body.input ?? body.username);

    const result = await runLetterboxdScraper(profileInput);
    const status = result.ok ? 200 : 400;

    return Response.json(result, { status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scrape Letterboxd profile.";

    return Response.json(
      {
        ok: false,
        error: message,
        films: [],
      },
      { status: 500 }
    );
  }
}
