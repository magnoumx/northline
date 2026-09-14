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
  const updated = stories[0]?.updatedAtIso ?? new Date(0).toISOString();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(brand.shortName)} Latest</title>
  <id>${origin}/</id>
  <updated>${updated}</updated>
  <link href="${origin}/atom.xml" rel="self" />
${stories
  .map(
    (story) => `  <entry>
    <title>${escapeXml(story.headline)}</title>
    <id>${origin}/story/${story.slug}</id>
    <link href="${origin}/story/${story.slug}" />
    <published>${story.publishedAtIso ?? updated}</published>
    <updated>${story.updatedAtIso ?? story.publishedAtIso ?? updated}</updated>
    <summary>${escapeXml(story.dek)}</summary>
  </entry>`,
  )
  .join("\n")}
</feed>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900",
    },
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
