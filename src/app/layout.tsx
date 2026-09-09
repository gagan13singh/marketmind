import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Type system:
 *  - Newsreader carries headlines and the analysis narrative. It reads as an
 *    editorial research note, which is what this product actually produces.
 *  - IBM Plex Sans handles interface text; it was drawn for technical contexts.
 *  - IBM Plex Mono carries every figure, with tabular numerals so columns align.
 *
 * Fonts are loaded via <link> rather than next/font deliberately. next/font
 * fetches at BUILD time, which means a transient network problem between the
 * build machine and Google Fonts fails the entire deployment. Link tags degrade
 * to the system stack instead, so typography can never break a release.
 */

export const metadata: Metadata = {
  title: {
    default: "MarketMind — Swing & positional analysis for Indian equities",
    template: "%s · MarketMind",
  },
  description:
    "Technical and fundamental analysis with written conclusions, a custom screener and strategy backtesting. Built for swing and positional horizons.",
  keywords: ["swing trading", "positional investing", "NSE", "technical analysis", "stock screener", "backtesting"],
  openGraph: {
    title: "MarketMind",
    description: "Analysis with conclusions, for swing and positional traders.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
};

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
