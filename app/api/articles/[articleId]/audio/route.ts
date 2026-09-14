import { getD1Binding } from "@/db";
import { readPublicArticleAudioBundle } from "@/lib/audio/public-read";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

type Context = { params: Promise<{ articleId: string }> };

export async function GET(
  _request: Request,
  context: Context,
): Promise<Response> {
  const { articleId } = await context.params;
  try {
    const bundle = await readPublicArticleAudioBundle({
      database: await getD1Binding(),
      articleId,
      playbackEnabled:
        process.env.FEATURE_ARTICLE_AUDIO === "true" &&
        process.env.ARTICLE_AUDIO_PLAYBACK_ENABLED === "true",
      degradedBrowserFallbackAvailable:
        process.env.BROWSER_SPEECH_FALLBACK_ENABLED === "true",
    });
    if (!bundle) return notFound();
    return Response.json(
      { audio: bundle },
      {
        headers: {
          "cache-control": "public, max-age=30, stale-while-revalidate=60",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Article audio status is temporarily unavailable.",
    });
  }
}

function notFound(): Response {
  return apiErrorResponse("NOT_FOUND", {
    status: 404,
    message: "Article audio was not found.",
  });
}
