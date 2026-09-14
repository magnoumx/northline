/**
 * What a reader signal is, and what it deliberately is not.
 *
 * The ingest route and the events table existed and were well built, but
 * nothing ever called them: the table held zero rows. Every "Most read",
 * "Trending" and "Top content" surface therefore had to be either relabelled
 * or removed, because none of them had measurement behind them.
 *
 * This module decides *what* is worth sending. The transport lives in the
 * client component; keeping the policy here makes it testable without a DOM.
 *
 * Privacy posture: no identifier that can be linked to a person leaves the
 * browser. The anonymous id is random, rotates with the session, and the server
 * only ever stores an HMAC of it.
 */

export type ReaderEventType =
  | "PAGE_VIEW"
  | "ENGAGED_READING"
  | "SCROLL_DEPTH"
  | "ARTICLE_COMPLETION"
  | "TRAFFIC_SOURCE";

export type ReaderEvent = {
  eventType: ReaderEventType;
  articleId?: string;
  properties?: {
    scrollBucket?: "25" | "50" | "75" | "100";
    sourceType?:
      | "DIRECT"
      | "SEARCH"
      | "SOCIAL"
      | "NEWSLETTER"
      | "REFERRAL"
      | "UNKNOWN";
  };
};

/** Article identifiers are `article_<token>`; anything else is not an article. */
const ARTICLE_ID = /^article_[A-Za-z0-9_-]{10,64}$/u;

export function isValidArticleId(value: string | null | undefined): boolean {
  return typeof value === "string" && ARTICLE_ID.test(value);
}

/**
 * Reading is time plus movement. A tab left open overnight is not reading, and
 * neither is a bounce, so an engaged read requires both a dwell threshold and
 * evidence the reader moved through the page.
 */
export const ENGAGED_READING_SECONDS = 15;

export function isEngagedRead(input: {
  visibleSeconds: number;
  maxScrollPercent: number;
}): boolean {
  return (
    input.visibleSeconds >= ENGAGED_READING_SECONDS &&
    input.maxScrollPercent >= 25
  );
}

/**
 * Scroll is reported in buckets, not as a continuous value, and each bucket is
 * reported once. Continuous reporting produces a request per scroll frame and
 * tells you nothing a bucket does not.
 */
export function scrollBucketsCrossed(
  percent: number,
  alreadySent: ReadonlySet<string>,
): ("25" | "50" | "75" | "100")[] {
  const thresholds = [25, 50, 75, 100] as const;
  return thresholds
    .filter(
      (threshold) =>
        percent >= threshold && !alreadySent.has(String(threshold)),
    )
    .map((threshold) => String(threshold) as "25" | "50" | "75" | "100");
}

/**
 * Classifies where a visit came from. Only the referrer host is examined; the
 * full referrer, which can carry a search query or a private URL, is discarded.
 */
export function classifyTrafficSource(
  referrer: string,
  selfHost: string,
): NonNullable<NonNullable<ReaderEvent["properties"]>["sourceType"]> {
  if (!referrer) return "DIRECT";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    return "UNKNOWN";
  }
  if (host === selfHost.toLowerCase().replace(/^www\./u, "")) return "DIRECT";

  const search = [
    "google.",
    "bing.com",
    "duckduckgo.com",
    "search.yahoo",
    "ecosia.org",
    "brave.com",
    "startpage.com",
  ];
  const social = [
    "facebook.com",
    "instagram.com",
    "t.co",
    "x.com",
    "twitter.com",
    "reddit.com",
    "linkedin.com",
    "threads.net",
    "tiktok.com",
    "youtube.com",
    "news.ycombinator.com",
  ];

  if (search.some((needle) => host.includes(needle))) return "SEARCH";
  if (social.some((needle) => host.includes(needle))) return "SOCIAL";
  return "REFERRAL";
}

/**
 * Automated traffic must never reach the reader dataset, or "Most read" ends up
 * ranking whatever a crawler visited most.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python-requests|axios|scrapy|facebookexternalhit|bingpreview/iu;

export function looksAutomated(userAgent: string): boolean {
  if (!userAgent.trim()) return true;
  return BOT_PATTERN.test(userAgent);
}

/** A random, non-persistent identifier. Never derived from anything personal. */
export function createAnonymousId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Cloudflare's own edge-resolved country, never a geolocation call the client
 * made or an IP address stored anywhere. The summary dashboard has read
 * `metadata_json.country` since it was built, but nothing ever wrote it, so
 * every country breakdown was silently and permanently empty.
 */
export function coarseCountry(request: Request): string | null {
  const cloudflare = (request as Request & { cf?: { country?: unknown } }).cf;
  return typeof cloudflare?.country === "string" && /^[A-Z]{2}$/u.test(cloudflare.country)
    ? cloudflare.country
    : null;
}
