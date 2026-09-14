import type { Metadata } from "next";

export type PublicRouteMetadata = {
  title: string;
  description: string;
};

export const STATIC_PUBLIC_ROUTES: Readonly<Record<
  string,
  PublicRouteMetadata
>> = {
  latest: {
    title: "Latest U.S. news and updates",
    description:
      "The newest verified reporting and developing updates from Northline.",
  },
  trending: {
    title: "Trending in the United States",
    description:
      "The stories gaining verified momentum across U.S. news and culture.",
  },
  live: {
    title: "Live and developing coverage",
    description:
      "Time-stamped updates from Northline stories that are still developing.",
  },
  newsletter: {
    title: "The Daily Brief newsletter",
    description:
      "A concise briefing on what happened, why it matters, and what comes next.",
  },
  advertise: {
    title: "Advertise with Northline",
    description:
      "Explore restrained, clearly labeled advertising and sponsorship opportunities.",
  },
  "advertise/media-kit": {
    title: "Northline media kit",
    description:
      "Review Northline formats, standards, audience-data policy, and campaign process.",
  },
  "advertise/request": {
    title: "Request advertising information",
    description: "Send a secure inquiry to the Northline commercial team.",
  },
  about: {
    title: "About Northline",
    description:
      "Learn how Northline approaches modern U.S. reporting, verification, and reader trust.",
  },
  contact: {
    title: "Contact Northline",
    description:
      "Reach the Northline newsroom with corrections, tips, and editorial inquiries.",
  },
  "editorial-standards": {
    title: "Editorial standards",
    description:
      "Read Northline policies for sourcing, verification, corrections, and accountable AI assistance.",
  },
  "ai-policy": {
    title: "AI policy",
    description:
      "How Northline limits, reviews, and discloses AI assistance in editorial work.",
  },
  corrections: {
    title: "Corrections policy",
    description:
      "How Northline records visible corrections, updates, and retractions.",
  },
  ownership: {
    title: "Ownership and funding",
    description:
      "Northline ownership structure, funding sources, and editorial independence.",
  },
  funding: {
    title: "Funding and revenue",
    description:
      "How Northline is funded, including advertising, membership, and sponsorships.",
  },
  "sponsored-content-policy": {
    title: "Sponsored content policy",
    description:
      "How Northline labels, separates, and governs sponsored and branded content.",
  },
  security: {
    title: "Security",
    description:
      "How to report a vulnerability in Northline and what we commit to in return.",
  },
  privacy: {
    title: "Privacy policy",
    description: "How Northline collects, uses, and protects reader data.",
  },
  cookies: {
    title: "Cookie policy",
    description: "How Northline uses cookies and reader consent choices.",
  },
  terms: {
    title: "Terms of service",
    description: "The terms governing use of Northline.",
  },
};

export const PERSONAL_NOINDEX_ROUTES = new Set([
  "search",
  "saved",
  "following",
  "account",
  "maintenance",
  "offline",
  "410",
]);

export function publicRouteMetadata(routeKey: string): Metadata | null {
  const defined = STATIC_PUBLIC_ROUTES[routeKey];
  if (!defined) return null;
  return {
    ...defined,
    alternates: { canonical: `/${routeKey}` },
    openGraph: {
      type: "website",
      title: defined.title,
      description: defined.description,
      url: `/${routeKey}`,
    },
  };
}
