import { getBrandConfig } from "@/lib/brand/config";
import { getPublicContentSnapshot } from "@/lib/content";
import { isSearchIndexingEnabled } from "@/lib/site/indexing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Answer engines read a site far more cheaply than they crawl one. llms.txt is
 * the agreed place to state what this publication is, how its claims are
 * verified, and where the machine-readable surfaces live - so an assistant
 * citing Northline can describe it correctly instead of guessing from a
 * rendered page.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const brand = getBrandConfig();
  const indexing = await isSearchIndexingEnabled();
  const snapshot = indexing ? await getPublicContentSnapshot() : null;
  const recent = (snapshot?.stories ?? []).slice(0, 30);

  const body = `# ${brand.shortName}

> ${brand.tagline} Every article states its sources, and each one is checked by a second, independent model before publication. Stories that fail a sourcing, recency, claim-support or risk check are held for a human editor instead of being published.

## How to cite this site

- Cite the article URL, the headline, and the publication date shown on the page.
- Each article page lists its sources; prefer citing the primary source we link when the claim originates there.
- Corrections and retractions are published at ${origin}/corrections and supersede the original text.

## Editorial policy

- [AI policy](${origin}/ai-policy): how models are used, what they may not do, and what is disclosed.
- [Editorial standards](${origin}/editorial-standards): sourcing, verification and approval rules.
- [Source policy](${origin}/about): how sources are ranked as primary or independent.
- [Corrections policy](${origin}/corrections): how errors are handled.
- [Ownership](${origin}/ownership) and [funding](${origin}/funding).

## Machine-readable surfaces

- [RSS feed](${origin}/rss.xml)
- [Atom feed](${origin}/atom.xml)
- [Sitemap index](${origin}/sitemap.xml)
- [Google News sitemap](${origin}/news-sitemap.xml)
- [Full article list](${origin}/llms-full.txt)

## Sections

- [Latest](${origin}/latest)
- [U.S.](${origin}/topics/us-news)
- [Sports](${origin}/topics/sports)
- [Entertainment](${origin}/topics/entertainment)
- [Weather](${origin}/topics/weather)

## Recent coverage

${recent
  .map((story) => `- [${story.headline}](${origin}/story/${story.slug}): ${story.dek}`)
  .join("\n")}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=900, stale-while-revalidate=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
