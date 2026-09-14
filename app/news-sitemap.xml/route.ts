import { getBrandConfig } from "@/lib/brand/config";
import { getPublicContentSnapshot } from "@/lib/content";
import { isSearchIndexingEnabled } from "@/lib/site/indexing";
import { isNewsSitemapEligible } from "@/lib/seo/sitemap-eligibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const brand = getBrandConfig();
  const { stories } = await getPublicContentSnapshot();
  const now = new Date();
  const indexedStories = (await isSearchIndexingEnabled())
    ? stories.filter((story) => isNewsSitemapEligible(story, now))
    : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${indexedStories
  .map(
    (story) => `  <url>
    <loc>${origin}/story/${story.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(brand.name)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${story.publishedAtIso}</news:publication_date>
      <news:title>${escapeXml(story.headline)}</news:title>
    </news:news>
  </url>`,
  )
  .join("\n")}
</urlset>`;
  return xmlResponse(xml);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
      "x-robots-tag": "noindex",
    },
  });
}
