export type ArticleAudioState =
  | "NOT_REQUESTED"
  | "QUEUED"
  | "GENERATING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "STALE"
  | "REJECTED";

export type ArticleAudioChapter = {
  id: string;
  title: string;
  startSeconds: number;
};

export type ArticleAudioTiming = {
  id: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
};

export type ArticleAudioTrack = {
  state?: ArticleAudioState;
  src?: string;
  durationSeconds: number;
  chapters: ArticleAudioChapter[];
  skipIntroductionSeconds?: number;
  timings?: ArticleAudioTiming[];
};

export type ArticleAudioMetadata = {
  state?: ArticleAudioState;
  quick?: ArticleAudioTrack;
  full?: ArticleAudioTrack;
  voiceLabel?: string;
  publishedVersion?: string;
  disclosure?: string;
  degradedBrowserFallbackAvailable?: boolean;
};

const AUDIO_STATES = new Set<ArticleAudioState>([
  "NOT_REQUESTED",
  "QUEUED",
  "GENERATING",
  "PROCESSING",
  "READY",
  "FAILED",
  "STALE",
  "REJECTED",
]);

/**
 * Converts the provider-neutral public API response into display data. The
 * adapter deliberately accepts unknown input so a malformed network response
 * can never inject an arbitrary media URL or crash the reader.
 */
export function toArticleAudioMetadata(
  value: unknown,
): ArticleAudioMetadata | undefined {
  const response = asRecord(value);
  const bundle = asRecord(response?.audio ?? value);
  const tracks = asRecord(bundle?.tracks);
  if (!bundle || !tracks) return undefined;

  const quick = toTrack(tracks.QUICK_BRIEF);
  const full = toTrack(tracks.FULL_ARTICLE);
  if (!quick && !full) return undefined;

  const fallbackAllowed =
    readBoolean(asRecord(tracks.QUICK_BRIEF)?.degradedBrowserFallbackAvailable) ??
    readBoolean(asRecord(tracks.FULL_ARTICLE)?.degradedBrowserFallbackAvailable);
  const disclosure =
    readDisclosure(asRecord(tracks.FULL_ARTICLE)?.disclosure) ??
    readDisclosure(asRecord(tracks.QUICK_BRIEF)?.disclosure);
  const aggregateState =
    full?.state === "READY" || quick?.state === "READY"
      ? "READY"
      : full?.state ?? quick?.state;

  return {
    state: aggregateState,
    quick,
    full,
    publishedVersion: readBoundedString(bundle.articleVersionId, 160),
    disclosure,
    degradedBrowserFallbackAvailable: fallbackAllowed,
  };
}

function toTrack(value: unknown): ArticleAudioTrack | undefined {
  const track = asRecord(value);
  if (!track || !isAudioState(track.state)) return undefined;
  const durationMs = readNonNegativeInteger(track.durationMs) ?? 0;
  const chapters = Array.isArray(track.chapters)
    ? track.chapters.flatMap((chapter) => {
        const record = asRecord(chapter);
        const id = readBoundedString(record?.id, 120);
        const title = readBoundedString(record?.title, 200);
        const startMs = readNonNegativeInteger(record?.startMs);
        if (!record || !id || !title || startMs === undefined) return [];
        return [
          {
            id,
            title,
            startSeconds: startMs / 1_000,
          },
        ];
      })
    : [];
  const timings = Array.isArray(track.timings)
    ? track.timings.flatMap((timing, index) => {
        const record = asRecord(timing);
        const text = readBoundedString(record?.text, 2_000);
        const startMs = readNonNegativeInteger(record?.startMs);
        const endMs = readNonNegativeInteger(record?.endMs);
        if (
          !record ||
          !text ||
          startMs === undefined ||
          endMs === undefined ||
          endMs < startMs
        ) {
          return [];
        }
        return [
          {
            id: `timing-${index}-${startMs}`,
            text,
            startSeconds: startMs / 1_000,
            endSeconds: endMs / 1_000,
          },
        ];
      })
    : [];
  const firstChapter = chapters[0];
  const secondChapter = chapters[1];
  const skipIntroductionSeconds =
    firstChapter?.title.toLowerCase().includes("intro") && secondChapter
      ? secondChapter.startSeconds
      : undefined;

  return {
    state: track.state,
    src: safeStreamUrl(track.streamUrl),
    durationSeconds: durationMs / 1_000,
    chapters,
    timings,
    skipIntroductionSeconds,
  };
}

function safeStreamUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^\/api\/article-audio\/[A-Za-z0-9%:_-]{1,240}\/stream$/u.test(value)
    ? value
    : undefined;
}

function isAudioState(value: unknown): value is ArticleAudioState {
  return typeof value === "string" && AUDIO_STATES.has(value as ArticleAudioState);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function readBoundedString(
  value: unknown,
  maximumLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximumLength ? trimmed : undefined;
}

function readDisclosure(value: unknown): string | undefined {
  return value === "AI-generated narration" ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
