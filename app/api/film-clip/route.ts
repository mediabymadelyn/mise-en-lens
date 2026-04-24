export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim();

  if (!title) {
    return Response.json({ ok: false, error: "Missing title" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: "YouTube API not configured" }, { status: 500 });
  }

  const query = encodeURIComponent(`${title} full movie recap`);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return Response.json({ ok: false }, { status: 200 });
    }
    const data = (await res.json()) as {
      items?: Array<{ id: { videoId: string }; snippet: { title: string } }>;
    };
    const item = data.items?.[0];
    if (!item) {
      return Response.json({ ok: false }, { status: 200 });
    }
    return Response.json({ ok: true, videoId: item.id.videoId, title: item.snippet.title });
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
