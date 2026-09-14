import {
  normalizeEditorialEmbed,
  type EditorialEmbed,
} from "./editorial-embeds";

export type VerifiedEditorialVideo = EditorialEmbed & {
  /** Real title returned by the platform, not a model-supplied string. */
  title: string;
  /** Channel or account that owns the video, as reported by the platform. */
  publisher: string;
  publisherUrl: string | null;
  thumbnailUrl: string | null;
  verifiedAt: string;
};

type OEmbedResponse = {
  title?: unknown;
  author_name?: unknown;
  author_url?: unknown;
  thumbnail_url?: unknown;
  html?: unknown;
};

/**
 * Only platforms that publish a public oEmbed endpoint are verifiable, and only
 * a verifiable video is embedded. A model may propose a URL, but nothing is
 * rendered until the platform itself confirms the video exists and permits
 * embedding.
 */
const OEMBED_ENDPOINTS: Partial<
  Record<EditorialEmbed["provider"], (sourceUrl: string) => string>
> = {
  YouTube: (sourceUrl) =>
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(sourceUrl)}`,
  Vimeo: (sourceUrl) =>
    `https://vimeo.com/api/oembed.json?dnt=1&url=${encodeURIComponent(sourceUrl)}`,
  TikTok: (sourceUrl) =>
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`,
};

export async function verifyEditorialVideo(
  candidateUrl: string,
  options: { fetchImpl?: typeof fetch; now?: () => Date } = {},
): Promise<VerifiedEditorialVideo | null> {
  const embed = normalizeEditorialEmbed(candidateUrl);
  if (!embed) return null;

  const endpoint = OEMBED_ENDPOINTS[embed.provider];
  if (!endpoint) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(endpoint(embed.sourceUrl), {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }

  // A private, deleted, region-blocked or embedding-disabled video answers with
  // an error status here, which is exactly the signal needed to skip it.
  if (!response.ok) return null;

  let payload: OEmbedResponse;
  try {
    payload = (await response.json()) as OEmbedResponse;
  } catch {
    return null;
  }

  const title = readString(payload.title);
  const publisher = readString(payload.author_name);
  if (!title || !publisher) return null;

  return {
    ...embed,
    title,
    publisher,
    publisherUrl: readHttpsUrl(payload.author_url),
    thumbnailUrl: readHttpsUrl(payload.thumbnail_url),
    verifiedAt: (options.now?.() ?? new Date()).toISOString(),
  };
}

/**
 * Scores how well a verified video matches the story. A video that merely
 * mentions a related person is not worth embedding; the goal is footage of the
 * event the article is about.
 */
export function videoRelevanceScore(
  video: Pick<VerifiedEditorialVideo, "title" | "publisher">,
  subject: string,
  headline: string,
): number {
  const haystack = `${video.title} ${video.publisher}`.toLowerCase();
  const subjectTerms = meaningfulTerms(subject);
  const headlineTerms = meaningfulTerms(headline);

  if (subjectTerms.length === 0) return 0;

  const subjectHits = subjectTerms.filter((term) =>
    haystack.includes(term),
  ).length;
  const headlineHits = headlineTerms.filter((term) =>
    haystack.includes(term),
  ).length;

  const subjectCoverage = subjectHits / subjectTerms.length;
  const headlineCoverage =
    headlineTerms.length > 0 ? headlineHits / headlineTerms.length : 0;

  return Number((subjectCoverage * 0.7 + headlineCoverage * 0.3).toFixed(3));
}

export async function selectEditorialVideo(
  candidateUrls: readonly string[],
  input: { subject: string; headline: string; minimumScore?: number },
  options: { fetchImpl?: typeof fetch; now?: () => Date } = {},
): Promise<VerifiedEditorialVideo | null> {
  const minimumScore = input.minimumScore ?? 0.5;
  const seen = new Set<string>();
  let best: { video: VerifiedEditorialVideo; score: number } | null = null;

  for (const candidate of candidateUrls.slice(0, 8)) {
    const key = candidate.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const video = await verifyEditorialVideo(candidate, options);
    if (!video) continue;

    const score = videoRelevanceScore(video, input.subject, input.headline);
    if (score < minimumScore) continue;
    if (!best || score > best.score) best = { video, score };
  }

  return best?.video ?? null;
}

function meaningfulTerms(value: string): string[] {
  return value
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 300 ? trimmed : null;
}

function readHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
