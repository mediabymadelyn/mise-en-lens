import { fetchWikiContextForFilms } from "@/lib/wikipedia/client";

export const runtime = "nodejs";

type LookupRequestBody = {
  titles?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LookupRequestBody;
    const titles = (body.titles ?? []).map((t) => t.trim()).filter(Boolean);

    if (titles.length === 0) {
      return Response.json({ ok: false, error: "No film titles provided." }, { status: 400 });
    }

    const wikiContext = await fetchWikiContextForFilms(titles);

    const results = titles.map((title) => {
      const ctx = wikiContext.get(title);
      if (!ctx) return { title, found: false as const };
      return {
        title,
        found: true as const,
        wikiTitle: ctx.wikiTitle,
        description: ctx.description,
        thumbnailUrl: ctx.thumbnailUrl,
        pageUrl: ctx.pageUrl,
      };
    });

    return Response.json({ ok: true, results }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
