import { getBrandConfig } from "@/lib/brand/config";
import { getPublicContentSnapshot } from "@/lib/content";
import { isSearchIndexingEnabled } from "@/lib/site/indexing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const brand = getBrandConfig();
  const indexing = await isSearchIndexingEnabled();
  const snapshot = await getPublicContentSnapshot();
  const stories = indexing ? snapshot.stories : [];
  const lastBuildDate = stories[0]?.updatedAtIso
    ? new Date(stories[0].updatedAtIso).toUTCString()
    : new Date(0).toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(brand.shortName)} Latest</title>
    <link>${origin}</link>
    <description>${escapeXml(brand.tagline)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${stories
  .map(
    (story) => `    <item>
      <title>${escapeXml(story.headline)}</title>
      <link>${origin}/story/${story.slug}</link>
      <guid isPermaLink="true">${origin}/story/${story.slug}</guid>
      <description>${escapeXml(story.dek)}</description>
      <pubDate>${new Date(story.publishedAtIso ?? 0).toUTCString()}</pubDate>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>`;
  return feedResponse(xml);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function feedResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900",
    },
  });
}
