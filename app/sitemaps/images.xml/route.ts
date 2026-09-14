import { getPublicContentSnapshot } from "@/lib/content";
import { isSearchIndexingEnabled } from "@/lib/site/indexing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const { stories } = await getPublicContentSnapshot();
  const indexedStories = (await isSearchIndexingEnabled())
    ? stories.filter(
        (story) =>
          !story.isDemo &&
          story.image &&
          story.image !== "/og.png" &&
          (story.image.startsWith("/") || /^https:\/\//.test(story.image)),
      )
    : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${indexedStories
  .map(
    (story) => {
      const imageUrl = new URL(story.image, origin).toString();
      return `  <url>
    <loc>${origin}/story/${story.slug}</loc>
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:caption>${escapeXml(story.imageAlt)}</image:caption>
      <image:title>${escapeXml(story.headline)}</image:title>
    </image:image>
  </url>`;
    },
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
