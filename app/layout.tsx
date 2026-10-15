import type { Metadata } from "next";
import { resolveSiteOrigin } from "@/lib/site/origin";
import Script from "next/script";
import { getBrandConfig } from "@/lib/brand/config";
import { isSearchIndexingEnabled } from "@/lib/site/indexing";
import { GoogleAdSenseLoader } from "@/components/google-adsense";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrandConfig();
  const origin = await resolveSiteOrigin();
  const indexingEnabled = await isSearchIndexingEnabled();

  return {
    metadataBase: new URL(origin),
    title: {
      default: `${brand.name} — ${brand.tagline}`,
      template: `%s · ${brand.name}`,
    },
    description: brand.tagline,
    applicationName: brand.name,
    keywords: [
      "US news",
      "trend intelligence",
      "news explainers",
      "source transparency",
    ],
    category: "news",
    creator: brand.name,
    publisher: brand.name,
    verification: process.env.GOOGLE_SITE_VERIFICATION?.trim()
      ? { google: process.env.GOOGLE_SITE_VERIFICATION.trim() }
      : undefined,
    icons: {
      // Only the SVG mark ships with the site. Advertising a /favicon.ico that
      // does not exist made every page request a 404 asset.
      icon: [{ url: brand.favicon, type: "image/svg+xml" }],
      shortcut: brand.favicon,
      apple: brand.favicon,
    },
    robots: {
      index: indexingEnabled,
      follow: indexingEnabled,
      googleBot: {
        index: indexingEnabled,
        follow: indexingEnabled,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      siteName: brand.name,
      title: `${brand.name} — ${brand.tagline}`,
      description: brand.tagline,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: `${brand.name} — ${brand.tagline}`,
        },
      ],
    },
    // Only the card type is set here. Naming a title, description or image at
    // the root made those values win on every page: an article sets its own
    // `openGraph` but not its own `twitter`, so all 69 articles shared one
    // generic X card showing the site tagline and the site og.png. Next.js
    // falls back to `openGraph` for any twitter field left unset, so leaving
    // them out is what makes each article's card its own.
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Hero photographs are served from Wikimedia, so the largest element on
          an article page sits behind a DNS lookup, a TCP connection and a TLS
          handshake to a host the browser has never seen. The image is already
          preloaded with high priority, but a preload cannot start until the
          connection exists. Opening it during head parsing takes that round
          trip off the critical path.

          This is the free half of the fix. The other half - serving those
          images from our own origin as WebP - needs the Cloudflare Images
          binding, which is not configured.
        */}
        <link rel="preconnect" href="https://upload.wikimedia.org" />
        <link
          rel="dns-prefetch"
          href="https://upload.wikimedia.org"
        />
        {/* Feed autodiscovery lives here, not in metadata.alternates: any page that
            sets its own canonical replaces the whole alternates object, which
            silently dropped these links from every page. */}
        <link rel="alternate" type="application/rss+xml" title="Northline" href="/rss.xml" />
        <link rel="alternate" type="application/atom+xml" title="Northline" href="/atom.xml" />
      </head>
      <body className="antialiased">
        <Script
          src="/reader-preferences.js"
          strategy="beforeInteractive"
        />
        <GoogleAdSenseLoader />
        {children}
      </body>
    </html>
  );
}
