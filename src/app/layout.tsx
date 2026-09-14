import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
    default: "MarketMind — Think Markets Ahead",
    template: "%s · MarketMind",
  },
  description:
    "Technical and fundamental analysis with written conclusions, a custom screener and strategy backtesting. Built for swing and positional horizons on Indian equities.",
  keywords: ["swing trading", "positional investing", "NSE", "technical analysis", "stock screener", "backtesting", "Indian stocks"],
  openGraph: {
    title: "MarketMind — Think Markets Ahead",
    description: "Analysis with conclusions, for swing and positional traders.",
    type: "website",
    siteName: "MarketMind",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/icons/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MarketMind",
  },
  applicationName: "MarketMind",
};

export const viewport: Viewport = {
  themeColor: "#080f1c",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
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
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
      {/* Register service worker after hydration — using next/script to avoid React raw-script warning */}
      <Script
        id="sw-register"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            }
          `,
        }}
      />
    </html>
  );
}
