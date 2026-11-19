import { splashImage } from "@/lib/pwaArt";
import { SPLASH_SIZES } from "@/lib/splash";

export function generateStaticParams() {
  return SPLASH_SIZES.map(([w, h]) => ({ dims: `${w}x${h}` }));
}

export async function GET(_: Request, { params }: { params: Promise<{ dims: string }> }) {
  const { dims } = await params;
  const hit = SPLASH_SIZES.find(([w, h]) => `${w}x${h}` === dims);
  if (!hit) return new Response("Not found", { status: 404 });
  const res = await splashImage(hit[0], hit[1]);
  res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return res;
}
