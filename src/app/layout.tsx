import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import PwaRegister from "@/components/PwaRegister";
import Analytics from "@/components/Analytics";
import { BRAND } from "@/lib/brand";
import { splashStartupImages } from "@/lib/splash";
import "./globals.css";
import "./themes.css";

// Fonts ship with the app (npm packages), so builds never need to reach Google Fonts.
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});
const oswald = localFont({
  src: [
    { path: "../../node_modules/@fontsource/oswald/files/oswald-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/oswald/files/oswald-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

const SITE = BRAND.appUrl; // the public address; link previews need absolute image URLs
const TITLE = `${BRAND.name} · ${BRAND.motto}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.author, url: BRAND.site }],
  creator: BRAND.author,
  keywords: ["time tracker", "daily time budget", "timeboxing", "focus", "ADHD", "productivity", "timer"],
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "default",
    startupImage: splashStartupImages,
  },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "en_US",
    title: TITLE,
    description: BRAND.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: BRAND.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

// Applies the saved theme before first paint so there is no flash of the default theme.
const themeScript = `try{var a=JSON.parse(localStorage.getItem("timetracker:appearance")||"{}");document.documentElement.dataset.theme=a.theme||"white"}catch(e){document.documentElement.dataset.theme="white"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`} data-theme="white" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
