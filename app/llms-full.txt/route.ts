import { getPublicContentSnapshot } from "@/lib/content";
import { isSearchIndexingEnabled } from "@/lib/site/indexing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The long form of llms.txt: every published story with its dek, section and
 * publication date, so an assistant can resolve a question to the right article
 * without crawling the archive page by page.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const indexing = await isSearchIndexingEnabled();
  const snapshot = indexing ? await getPublicContentSnapshot() : null;
  const stories = snapshot?.stories ?? [];

  const body = `# Northline: published coverage

Generated ${new Date().toISOString()}. ${stories.length} articles.
Each entry: headline, section, publication date, summary, URL.

${stories
  .map(
    (story) =>
      `## ${story.headline}
Section: ${story.category}
Published: ${story.publishedAtIso ?? "unknown"}
Summary: ${story.dek}
URL: ${origin}/story/${story.slug}
`,
  )
  .join("\n")}`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=900, stale-while-revalidate=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
