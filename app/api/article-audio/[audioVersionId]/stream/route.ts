import { getD1Binding } from "@/db";
import { readStreamableAudioObject } from "@/lib/audio/public-read";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

type Context = { params: Promise<{ audioVersionId: string }> };
type AudioRuntimeEnvironment = {
  ARTICLE_AUDIO?: R2Bucket;
};

export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  if (
    process.env.FEATURE_ARTICLE_AUDIO !== "true" ||
    process.env.ARTICLE_AUDIO_PLAYBACK_ENABLED !== "true"
  ) {
    return notFound();
  }
  const { audioVersionId } = await context.params;
  try {
    const audio = await readStreamableAudioObject({
      database: await getD1Binding(),
      audioVersionId,
    });
    if (!audio) return notFound();
    const { env } = await import("cloudflare:workers");
    const bucket = (env as unknown as AudioRuntimeEnvironment).ARTICLE_AUDIO;
    if (!bucket) {
      return apiErrorResponse("UNAVAILABLE", {
        status: 503,
        message: "Article audio storage is unavailable.",
      });
    }
    const head = await bucket.head(audio.storageKey);
    if (!head) return notFound();
    const range = parseRange(request.headers.get("range"), head.size);
    if (range === "INVALID") {
      return new Response(null, {
        status: 416,
        headers: {
          "content-range": `bytes */${head.size}`,
          "cache-control": "no-store",
        },
      });
    }
    const object = await bucket.get(
      audio.storageKey,
      range ? { range } : undefined,
    );
    if (!object) return notFound();
    const status = range ? 206 : 200;
    const contentLength = range?.length ?? head.size;
    const headers = new Headers({
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(contentLength),
      "content-type": audio.contentType,
      "content-disposition": audio.downloadAllowed
        ? 'inline; filename="northline-article-audio.mp3"'
        : "inline",
      etag: object.httpEtag,
      "x-content-type-options": "nosniff",
    });
    if (range) {
      headers.set(
        "content-range",
        `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`,
      );
    }
    return new Response(object.body, { status, headers });
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Article audio is temporarily unavailable.",
    });
  }
}

function parseRange(
  header: string | null,
  size: number,
): { offset: number; length: number } | null | "INVALID" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return "INVALID";
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "INVALID";
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return "INVALID";
  }
  const end = Math.min(requestedEnd, size - 1);
  return { offset: start, length: end - start + 1 };
}

function notFound(): Response {
  return apiErrorResponse("NOT_FOUND", {
    status: 404,
    message: "Article audio was not found.",
  });
}
