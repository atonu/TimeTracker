import { iconImage } from "@/lib/pwaArt";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so this one is a full-bleed square.
export default function AppleIcon() {
  return iconImage(180, 0.17);
}
