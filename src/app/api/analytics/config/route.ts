export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The public PostHog project key, read when the server runs so it can change without a rebuild. */
export async function GET() {
  const key = (process.env.POSTHOG_KEY || "").trim();
  return Response.json({ key: key || null }, { headers: { "Cache-Control": "no-store" } });
}
