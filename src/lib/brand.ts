const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://tickwell.atonu.online" : "http://localhost:3000");

export const BRAND = {
  name: "Tickwell",
  motto: "Allocate. Organize. Daily life.",
  tagline: "A calm daily time budget for the things that matter.",
  /** Short enough for link previews (about 150 characters). */
  description:
    "A calm daily time budget for the things that matter. Set limits for your topics, run timers side by side, and see where your hours go.",
  author: "Atonu Ahmed",
  /** The author's own site, shown in Help. */
  site: "https://atonu.online",
  /** Where the app itself lives. Used for link previews and the install manifest. */
  appUrl: SITE_URL,
  host: SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, ""),
};
