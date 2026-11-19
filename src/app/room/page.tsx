import type { Metadata } from "next";
import Tickwell from "@/components/Tickwell";

// A sample room with example topics. Real rooms are private links; their addresses are shown to analytics as
// "/room", so this page is what heatmaps are drawn over. Nothing here is saved or shared.
export const metadata: Metadata = {
  title: "Tickwell sample room",
  robots: { index: false, follow: false },
};

export default function SampleRoomPage() {
  return <Tickwell key="sample" roomId="sample" demo />;
}
