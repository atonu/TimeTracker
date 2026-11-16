import { iconImage } from "@/lib/pwaArt";

// name: "192", "512" or "maskable-512". Maskable icons keep the mark inside the 80% safe zone.
const SPECS: Record<string, [number, number]> = {
  "192": [192, 0.16],
  "512": [512, 0.16],
  "maskable-512": [512, 0.28],
};

export function generateStaticParams() {
  return Object.keys(SPECS).map((name) => ({ name }));
}

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const spec = SPECS[name];
  if (!spec) return new Response("Not found", { status: 404 });
  const res = iconImage(spec[0], spec[1]);
  res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return res;
}
