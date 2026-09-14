import type {
  ArticleAudioState,
  ArticleAudioVariant,
  AudioChapterTiming,
  AudioTiming,
  PublicArticleAudio,
} from "./types";

type PublicAudioRow = {
  articleId: string;
  articleVersionId: string;
  audioVersionId: string | null;
  variant: ArticleAudioVariant | null;
  state: ArticleAudioState | null;
  durationMs: number | null;
  chapterTimingsJson: string | null;
  speechTimingsJson: string | null;
  disclosure: string | null;
  downloadAllowed: number | null;
};

export type PublicArticleAudioBundle = {
  articleId: string;
  articleVersionId: string;
  tracks: Readonly<Record<ArticleAudioVariant, PublicArticleAudio>>;
};

export async function readPublicArticleAudioBundle(input: {
  database: D1Database;
  articleId: string;
  playbackEnabled: boolean;
  degradedBrowserFallbackAvailable: boolean;
}): Promise<PublicArticleAudioBundle | null> {
  if (!/^[A-Za-z0-9:_-]{8,160}$/u.test(input.articleId)) return null;
  const result = await input.database
    .prepare(
      `SELECT a.id AS articleId, v.id AS articleVersionId,
         av.id AS audioVersionId, av.variant AS variant, av.state AS state,
         av.duration_ms AS durationMs,
         av.chapter_timings_json AS chapterTimingsJson,
         av.speech_timings_json AS speechTimingsJson,
         av.disclosure AS disclosure,
         av.download_allowed AS downloadAllowed
       FROM articles a
       INNER JOIN article_versions v
         ON v.id = a.current_version_id AND v.article_id = a.id
       LEFT JOIN article_audio_versions av
         ON av.article_version_id = v.id AND av.article_id = a.id
       WHERE a.id = ?1 AND a.state IN (
         'PUBLISHED','DEVELOPING','UPDATED','CORRECTED','ARCHIVED'
       ) AND a.published_at IS NOT NULL AND v.published_at IS NOT NULL`,
    )
    .bind(input.articleId)
    .all<PublicAudioRow>();
  const first = result.results[0];
  if (!first) return null;
  const tracks = {
    FULL_ARTICLE: emptyPublicTrack(
      "FULL_ARTICLE",
      input.degradedBrowserFallbackAvailable,
    ),
    QUICK_BRIEF: emptyPublicTrack(
      "QUICK_BRIEF",
      input.degradedBrowserFallbackAvailable,
    ),
  };
  for (const row of result.results) {
    if (!row.variant || !row.state) continue;
    const ready = row.state === "READY" && input.playbackEnabled;
    tracks[row.variant] = {
      state: row.state,
      variant: row.variant,
      durationMs: ready ? row.durationMs : null,
      streamUrl:
        ready && row.audioVersionId
          ? `/api/article-audio/${encodeURIComponent(row.audioVersionId)}/stream`
          : null,
      chapters: ready
        ? safeArray(row.chapterTimingsJson, isChapterTiming)
        : [],
      timings: ready
        ? safeArray(row.speechTimingsJson, isAudioTiming)
        : [],
      disclosure: "AI-generated narration",
      downloadAllowed: ready && row.downloadAllowed === 1,
      degradedBrowserFallbackAvailable:
        input.degradedBrowserFallbackAvailable,
    };
  }
  return {
    articleId: first.articleId,
    articleVersionId: first.articleVersionId,
    tracks,
  };
}

export async function readStreamableAudioObject(input: {
  database: D1Database;
  audioVersionId: string;
}): Promise<{
  storageKey: string;
  contentType: string;
  downloadAllowed: boolean;
} | null> {
  if (!/^[A-Za-z0-9:_-]{8,160}$/u.test(input.audioVersionId)) return null;
  return input.database
    .prepare(
      `SELECT av.storage_key AS storageKey,
         av.content_type AS contentType,
         av.download_allowed AS downloadAllowed
       FROM article_audio_versions av
       INNER JOIN articles a
         ON a.id = av.article_id
         AND a.current_version_id = av.article_version_id
       INNER JOIN article_versions v
         ON v.id = av.article_version_id AND v.article_id = a.id
       WHERE av.id = ?1 AND av.state = 'READY'
         AND av.storage_key IS NOT NULL
         AND av.content_type LIKE 'audio/%'
         AND a.state IN (
           'PUBLISHED','DEVELOPING','UPDATED','CORRECTED','ARCHIVED'
         )
         AND a.published_at IS NOT NULL AND v.published_at IS NOT NULL
       LIMIT 1`,
    )
    .bind(input.audioVersionId)
    .first<{
      storageKey: string;
      contentType: string;
      downloadAllowed: boolean;
    }>();
}

function emptyPublicTrack(
  variant: ArticleAudioVariant,
  degradedBrowserFallbackAvailable: boolean,
): PublicArticleAudio {
  return {
    state: "NOT_REQUESTED",
    variant,
    durationMs: null,
    streamUrl: null,
    chapters: [],
    timings: [],
    disclosure: "AI-generated narration",
    downloadAllowed: false,
    degradedBrowserFallbackAvailable,
  };
}

function safeArray<T>(
  value: string | null,
  guard: (entry: unknown) => entry is T,
): T[] {
  try {
    const parsed = JSON.parse(value ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

function isChapterTiming(value: unknown): value is AudioChapterTiming {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const chapter = value as Partial<AudioChapterTiming>;
  return (
    typeof chapter.id === "string" &&
    typeof chapter.title === "string" &&
    Number.isInteger(chapter.startMs) &&
    Number.isInteger(chapter.endMs) &&
    Number(chapter.startMs) >= 0 &&
    Number(chapter.endMs) >= Number(chapter.startMs)
  );
}

function isAudioTiming(value: unknown): value is AudioTiming {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const timing = value as Partial<AudioTiming>;
  return (
    typeof timing.text === "string" &&
    Number.isInteger(timing.startMs) &&
    Number.isInteger(timing.endMs) &&
    Number.isInteger(timing.chapterIndex) &&
    Number(timing.startMs) >= 0 &&
    Number(timing.endMs) >= Number(timing.startMs)
  );
}
