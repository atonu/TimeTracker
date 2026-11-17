import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Tickwell from "@/components/Tickwell";
import { ROOM_ID_RE } from "@/lib/room";

type Props = { params: Promise<{ id: string }> };

// A room is private to whoever has the link, so keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  if (!ROOM_ID_RE.test(id)) notFound();
  return <Tickwell roomId={id} />;
}
