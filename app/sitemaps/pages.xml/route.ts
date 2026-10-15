import { listPublishedStoryIndex } from "@/lib/content";
import { isSearchIndexingEnabled } from "@/lib/site/indexing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const staticPaths = [
  "/",
  "/latest",
  "/trending",
  "/live",
  "/topics",
  "/newsletter",
  "/about",
  "/editorial-standards",
  "/ai-policy",
  "/corrections",
  "/ownership",
  "/funding",
  // The verification record is editorial output, not a policy page: it is the
  // one thing on this site that exists nowhere else, so it belongs in the
  // crawlable archive rather than behind the footer.
  "/record",
  "/advertise",
  "/privacy",
  "/cookies",
  "/terms",
];

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  // The permanent sitemap covers the whole canonical archive. It previously
  // reused the homepage snapshot, which is capped, so older stories silently
  // disappeared from discovery as the archive grew.
  const stories = await listPublishedStoryIndex();
  const indexing = await isSearchIndexingEnabled();
  const staticLastModified = stories[0]?.updatedAtIso?.slice(0, 10);
  // Topic pages are linked from every article breadcrumb and are the archive's
  // main crawl path between stories, but they were absent from discovery, so
  // search engines only ever reached them by following a story.
  const topicLastModified = new Map<string, string>();
  const topicStoryCount = new Map<string, number>();
  for (const story of stories) {
    if (!story.category) continue;
    const slug = story.category.trim().toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
    if (!slug) continue;
    topicStoryCount.set(slug, (topicStoryCount.get(slug) ?? 0) + 1);
    const modified =
      story.updatedAtIso?.slice(0, 10) ?? story.publishedAtIso?.slice(0, 10);
    const current = topicLastModified.get(slug);
    if (modified && (!current || modified > current)) {
      topicLastModified.set(slug, modified);
    } else if (!current) {
      topicLastModified.set(slug, modified ?? "");
    }
  }
  // Every story is already listed directly below, but the archive pager
  // pages are how a reader or crawler actually walks the older archive
  // instead of only ever landing on a story from a search result.
  const LATEST_PAGE_SIZE = 24;
  const totalLatestPages = Math.ceil(stories.length / LATEST_PAGE_SIZE);
  const latestArchivePages = Array.from(
    { length: Math.max(0, totalLatestPages - 1) },
    (_, index) => ({
      path: `/latest/page/${index + 2}`,
      lastModified: undefined,
    }),
  );
  const paths = indexing
    ? [
        // No lastmod on static pages or archive pager pages. They do not change
        // when an article is published, and a lastmod that always equals the newest
        // story teaches Google to ignore this sitemap's dates altogether.
        ...staticPaths.map((path) => ({ path, lastModified: undefined })),
        ...latestArchivePages,
        // A topic holding one or two stories is served `noindex` by the page
        // itself, so submitting it here would ask Google to spend a crawl on a
        // URL it is then told not to index. The threshold has to match
        // MINIMUM_INDEXABLE_TOPIC_STORIES in app/[...slug]/page.tsx.
        ...[...topicLastModified.entries()]
          .filter(([slug]) => (topicStoryCount.get(slug) ?? 0) >= 3)
          .map(([slug, lastModified]) => ({
            path: `/topics/${slug}`,
            lastModified: lastModified || undefined,
          })),
        ...stories.map((story) => ({
          path: `/story/${story.slug}`,
          lastModified:
            story.updatedAtIso?.slice(0, 10) ??
            story.publishedAtIso?.slice(0, 10),
        })),
      ]
    : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    ({ path, lastModified }) => `  <url>
    <loc>${origin}${path}</loc>
    ${lastModified ? `<lastmod>${lastModified}</lastmod>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
      "x-robots-tag": "noindex",
    },
  });
}
