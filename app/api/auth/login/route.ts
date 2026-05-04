export const runtime = "nodejs";

export async function POST(request: Request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    return Response.json({ ok: false, error: "Auth not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { password?: string; from?: string };
  if (body.password !== password) {
    return Response.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  const redirectTo = body.from && body.from.startsWith("/") ? body.from : "/";

  const response = Response.json({ ok: true, redirectTo });
  response.headers.set(
    "Set-Cookie",
    `site-auth=${password}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
  return response;
}
