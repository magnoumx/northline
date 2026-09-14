/**
 * Finding the rightsholder's own footage.
 *
 * Until now a video reached an article only if one of the cited sources
 * happened to be a video page. News sources are almost always article pages, so
 * in practice almost nothing was ever found. Asking a model for video URLs is
 * not an option: a plausible-looking eleven-character id is trivial to invent
 * and impossible to distinguish from a real one without checking.
 *
 * This searches YouTube directly, so every candidate is a video that provably
 * exists, and then narrows to uploads on the news organisation's own channel.
 * That second step is the editorial one. A search for any breaking story
 * returns mostly re-uploads of someone else's footage; embedding one of those
 * puts material on the page under a channel with no right to it. Only the
 * outlet that filmed it gets embedded, and its player keeps its own branding
 * and attribution.
 *
 * Discovery does not replace verification. What comes back here is a list of
 * candidate URLs, which still go through the oEmbed check in
 * `video-verification.ts` before anything is rendered.
 */

export type YouTubeVideoCandidate = {
  videoId: string;
  sourceUrl: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: string;
};

export type YouTubeSearchPlan =
  | { ok: true; endpoint: string; loggableEndpoint: string }
  | { ok: false; reason: "not_configured" | "no_subject" };

/**
 * News footage ages out fast. A month-old clip about a live story is usually
 * about an earlier development and is worse than no video at all.
 */
export const DEFAULT_RECENCY_DAYS = 7;

/** A YouTube video id is eleven characters of the URL-safe alphabet. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;

/**
 * Channels whose uploads are that organisation's own footage.
 *
 * Matched whole, case-insensitively, so "BBC News Highlights" - a re-uploader -
 * does not pass as "BBC News". A channel title is display text and can be
 * imitated, which is why `channelId` is carried through to the diagnostic
 * record: once a real id has been observed for a channel it can be pinned here
 * via `pinnedChannelIds` and the name stops mattering.
 *
 * Conservative by design. An outlet missing from this list costs one video; an
 * outlet wrongly added costs a rights complaint.
 */
const TRUSTED_NEWS_CHANNELS: ReadonlySet<string> = new Set(
  [
    // Wire services and broadcasters.
    "Reuters",
    "Associated Press",
    "AP Archive",
    "Bloomberg Television",
    "CNBC",
    "CNBC Television",
    "BBC News",
    "Sky News",
    "PBS NewsHour",
    "C-SPAN",
    "NPR",
    "CBS News",
    "ABC News",
    "NBC News",
    "CNN",
    "Guardian News",
    "The Telegraph",
    "Al Jazeera English",
    "DW News",
    "FRANCE 24 English",
    "CNA",
    "Global News",
    "NASA",
    "The White House",

    // Studios, for the official trailer or clip a film story is actually about.
    "Marvel Entertainment",
    "Sony Pictures Entertainment",
    "Warner Bros. Pictures",
    "Universal Pictures",
    "Paramount Pictures",
    "20th Century Studios",
    // Spelled without a space on YouTube; the spaced form never matches.
    "SearchlightPictures",
    "Sony Pictures Canada",
    "A24",
    "Lionsgate Movies",
    "Focus Features",
    "Netflix",
    "Prime Video",
    "Apple TV",
    "Max",
    "Hulu",
    "Disney+",

    // Entertainment desks that shoot their own interviews and red carpets.
    "Entertainment Tonight",
    "extratv",
    "Variety",
    "The Hollywood Reporter",
    "Access",
    "E! News",
    "TODAY",

    // Leagues and sports broadcasters own the footage of the play itself.
    "MLB",
    "NBA",
    "NFL",
    "NHL",
    "ESPN",
    "NBC Sports",
    "FOX Sports",
    "CBS Sports",
    "Bleacher Report",
    "Sky Sports",
  ].map((name) => name.toLowerCase()),
);

export function isTrustedNewsChannel(
  channelTitle: string,
  pinnedChannelIds?: ReadonlySet<string>,
  channelId?: string,
): boolean {
  if (channelId && pinnedChannelIds?.has(channelId)) return true;
  return TRUSTED_NEWS_CHANNELS.has(channelTitle.trim().toLowerCase());
}

/**
 * Words that carry no search signal. Headlines are written to read well, and
 * the connective tissue that makes them readable only dilutes a query.
 */
const NOISE_TERMS: ReadonlySet<string> = new Set([
  "the", "and", "for", "with", "from", "that", "this", "has", "have", "had",
  "was", "were", "will", "would", "could", "should", "its", "his", "her",
  "their", "over", "into", "after", "before", "amid", "says", "said", "say",
  "new", "more", "than", "but", "not", "are", "how", "why", "what", "who",
]);

export function buildYouTubeQuery(subject: string, headline: string): string {
  const subjectTerms = meaningfulTerms(subject);
  if (subjectTerms.length === 0) return "";

  // The subject leads; headline terms only fill the remaining room, so a story
  // is never searched for by its adjectives.
  const seen = new Set(subjectTerms);
  const extra = meaningfulTerms(headline).filter((term) => {
    if (seen.has(term)) return false;
    seen.add(term);
    return true;
  });

  return [...subjectTerms, ...extra].slice(0, 12).join(" ");
}

export function planYouTubeSearch(input: {
  subject: string;
  headline: string;
  key: string | undefined;
  maxResults?: number;
  recencyDays?: number;
  now?: () => Date;
}): YouTubeSearchPlan {
  const key = input.key?.trim() ?? "";
  if (!key) return { ok: false, reason: "not_configured" };

  const query = buildYouTubeQuery(input.subject, input.headline);
  if (!query) return { ok: false, reason: "no_subject" };

  const recencyDays = input.recencyDays ?? DEFAULT_RECENCY_DAYS;
  const publishedAfter = new Date(
    (input.now?.() ?? new Date()).getTime() - recencyDays * 86_400_000,
  ).toISOString();

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  // A video that forbids embedding would pass verification and then render as
  // an error frame, so it is excluded at the source.
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("order", "relevance");
  url.searchParams.set("regionCode", "US");
  url.searchParams.set("relevanceLanguage", "en");
  url.searchParams.set("publishedAfter", publishedAfter);
  url.searchParams.set(
    "maxResults",
    String(Math.min(Math.max(input.maxResults ?? 10, 1), 25)),
  );

  const loggable = url.toString();
  url.searchParams.set("key", key);

  return {
    ok: true,
    endpoint: url.toString(),
    // Diagnostics record the query that ran, never the credential that ran it.
    loggableEndpoint: `${loggable}&key=REDACTED`,
  };
}

/**
 * Runs the search and returns the trusted candidates.
 *
 * Never throws and never reports a failure upward. A missing video is a poorer
 * article; a thrown error here would fail a publication that is otherwise
 * complete, which is much worse.
 */
export async function discoverOfficialVideos(
  input: {
    subject: string;
    headline: string;
    key: string | undefined;
    maxResults?: number;
    recencyDays?: number;
    pinnedChannelIds?: ReadonlySet<string>;
    now?: () => Date;
  },
  options: { fetchImpl?: typeof fetch } = {},
): Promise<YouTubeVideoCandidate[]> {
  const plan = planYouTubeSearch(input);
  if (!plan.ok) return [];

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(plan.endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return [];
  }

  // 403 is the quota ceiling as well as a disabled key. Either way there is
  // nothing to retry inside this run.
  if (!response.ok) return [];

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return [];
  }

  const items = readArray(readRecord(payload)?.items);
  const candidates: YouTubeVideoCandidate[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const record = readRecord(item);
    if (!record) continue;

    const videoId = readString(readRecord(record.id)?.videoId);
    if (!videoId || !VIDEO_ID.test(videoId) || seen.has(videoId)) continue;

    const snippet = readRecord(record.snippet);
    const channelTitle = readString(snippet?.channelTitle);
    const channelId = readString(snippet?.channelId);
    if (!channelTitle || !channelId) continue;
    if (!isTrustedNewsChannel(channelTitle, input.pinnedChannelIds, channelId)) {
      continue;
    }

    seen.add(videoId);
    candidates.push({
      videoId,
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      channelId,
      channelTitle,
      title: readString(snippet?.title) ?? "",
      publishedAt: readString(snippet?.publishedAt) ?? "",
    });
  }

  return candidates;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 300 ? trimmed : null;
}

function meaningfulTerms(value: string): string[] {
  return value
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !NOISE_TERMS.has(term));
}
