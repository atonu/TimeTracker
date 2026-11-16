import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import "./themes.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const oswald = Oswald({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Time Tracker",
  description: "Parallel daily timers for the things you spend time on.",
};

// Applies the saved theme before first paint so there is no flash of the default theme.
const themeScript = `try{var a=JSON.parse(localStorage.getItem("timetracker:appearance")||"{}");document.documentElement.dataset.theme=a.theme||"gray"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`} data-theme="gray" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
