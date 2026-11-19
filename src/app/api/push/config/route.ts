import { publicKey, pushConfigured } from "@/lib/server/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether this server can send notifications, and the public key a browser needs to subscribe. */
export async function GET() {
  return Response.json(
    { configured: pushConfigured(), publicKey: pushConfigured() ? publicKey() : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
