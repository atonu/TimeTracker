export type ThemeDef = {
  id: string;
  name: string;
  mode: "light" | "dark";
  bg: string;
  paper: string;
  ink: string;
  accent: string;
};

export const THEMES: ThemeDef[] = [
  { id: "gray", name: "Gray", mode: "light", bg: "#f2f2f3", paper: "#ffffff", ink: "#0b0b0c", accent: "#9a9aa1" },
  { id: "white", name: "White", mode: "light", bg: "#ffffff", paper: "#ffffff", ink: "#0b0b0c", accent: "#d4d4d8" },
  { id: "sand", name: "Sand", mode: "light", bg: "#f3ece2", paper: "#fffdf9", ink: "#2b2118", accent: "#e8a876" },
  { id: "sage", name: "Sage", mode: "light", bg: "#e8eee6", paper: "#fbfdfa", ink: "#18231b", accent: "#8fc3a0" },
  { id: "lavender", name: "Lavender", mode: "light", bg: "#ece9f7", paper: "#fdfcff", ink: "#1e1a33", accent: "#b6a4f2" },
  { id: "rose", name: "Rose", mode: "light", bg: "#f8e9ec", paper: "#fffbfc", ink: "#2d1519", accent: "#f4a3b5" },
  { id: "sky", name: "Sky", mode: "light", bg: "#e6f0f8", paper: "#fbfdff", ink: "#10202e", accent: "#8cc4f2" },
  { id: "peach", name: "Peach", mode: "light", bg: "#fbece1", paper: "#fffcf9", ink: "#2e1a10", accent: "#f8b389" },
  { id: "midnight", name: "Midnight", mode: "dark", bg: "#0b0b0e", paper: "#16161a", ink: "#f4f4f6", accent: "#5b6cf0" },
  { id: "graphite", name: "Graphite", mode: "dark", bg: "#1c1c1e", paper: "#2a2a2d", ink: "#f2f2f3", accent: "#7a8499" },
  { id: "ocean", name: "Ocean", mode: "dark", bg: "#0a1624", paper: "#102236", ink: "#e8f1fa", accent: "#1f9de0" },
  { id: "nord", name: "Nord", mode: "dark", bg: "#2e3440", paper: "#3b4252", ink: "#eceff4", accent: "#88c0d0" },
  { id: "mocha", name: "Mocha", mode: "dark", bg: "#1e1e2e", paper: "#2a2b3d", ink: "#cdd6f4", accent: "#cba6f7" },
  { id: "forest", name: "Forest", mode: "dark", bg: "#0e1a14", paper: "#15261d", ink: "#e6f3ea", accent: "#3fae6d" },
  { id: "plum", name: "Plum", mode: "dark", bg: "#1a1020", paper: "#261830", ink: "#f6e9fb", accent: "#c44fd0" },
];

export type BgDef = { id: string; name: string; group: "none" | "pattern" | "abstract" };

export const BACKGROUNDS: BgDef[] = [
  { id: "none", name: "None", group: "none" },
  { id: "dots", name: "Dots", group: "pattern" },
  { id: "grid", name: "Grid", group: "pattern" },
  { id: "lines", name: "Lines", group: "pattern" },
  { id: "scales", name: "Scales", group: "pattern" },
  { id: "checks", name: "Checks", group: "pattern" },
  { id: "aurora", name: "Aurora", group: "abstract" },
  { id: "blobs", name: "Blobs", group: "abstract" },
  { id: "rings", name: "Rings", group: "abstract" },
  { id: "orbit", name: "Orbit", group: "abstract" },
  { id: "stripes", name: "Stripes", group: "abstract" },
  { id: "mesh", name: "Mesh", group: "abstract" },
];
