import type { Story } from "@/lib/site/types";
import { getBrandConfig } from "@/lib/brand/config";
import { publisherLogo } from "@/lib/site/publisher-logo";
import { categoryTopic, keywordsFor } from "@/lib/editorial/topic-derivation";

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replaceAll("<", "\\u003c"),
      }}
    />
  );
}

/**
 * A desk byline is the newsroom speaking, not a named journalist. Declaring it
 * as a Person invents an author who does not exist, which is exactly what
 * Google's guidance on AI-assisted publishing asks publishers not to do.
 */
const DESK_BYLINE = /\b(desk|newsroom|staff|editorial|bureau|team)\b/iu;

function authorEntity(
  author: string,
  origin: string,
  brandName: string,
): Record<string, unknown> {
  if (DESK_BYLINE.test(author)) {
    return {
      "@type": "Organization",
      name: author,
      url: origin,
      parentOrganization: { "@type": "Organization", name: brandName },
    };
  }
  return {
    "@type": "Person",
    name: author,
    url: `${origin}/authors/${author
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")}`,
  };
}

export function HomeStructuredData() {
  const brand = getBrandConfig();
  const origin = publicOrigin();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          // NewsMediaOrganization, not the generic Organization. It is the
          // subtype schema.org defines for a news publisher, and the four
          // accountability properties below are declared on it rather than
          // merely tolerated - which is what Google's news documentation reads.
          //
          // `sameAs` is deliberately absent: this outlet has no social profiles,
          // and pointing sameAs at a handle nobody here controls would assert an
          // identity that is not ours. It belongs here once real accounts exist.
          "@type": "NewsMediaOrganization",
          name: brand.name,
          url: origin,
          logo: publisherLogo(brand.logo, origin).url,
          description: brand.tagline,
          publishingPrinciples: `${origin}/editorial-standards`,
          ethicsPolicy: `${origin}/editorial-standards`,
          correctionsPolicy: `${origin}/corrections`,
          diversityPolicy: `${origin}/editorial-standards`,
          ownershipFundingInfo: `${origin}/ownership`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: brand.name,
          url: origin,
          potentialAction: {
            "@type": "SearchAction",
            target: `${origin}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
    </>
  );
}

export function StoryStructuredData({
  story,
  live = false,
}: {
  story: Story;
  live?: boolean;
}) {
  const brand = getBrandConfig();
  const origin = publicOrigin();
  const canonical = `${origin}${story.canonicalPath ?? `/story/${story.slug}`}`;
  const image = absoluteUrl(story.image, origin);
  // Every claim the article rests on, exposed as machine-readable citations.
  // This is the same evidence the reader sees, which is what search engines
  // look for when deciding whether reporting is sourced or asserted.
  const citations = story.sources
    .filter((source) => source.locator.startsWith("https://"))
    .slice(0, 24)
    .map((source) => ({
      "@type": "CreativeWork",
      name: source.name,
      url: source.locator,
    }));
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": live ? "LiveBlogPosting" : "NewsArticle",
          mainEntityOfPage: canonical,
          headline: story.headline,
          description: story.dek,
          image: [
            {
              "@type": "ImageObject",
              url: image,
              caption: story.imageCredit || story.imageAlt,
            },
          ],
          datePublished: story.publishedAtIso,
          dateModified: story.updatedAtIso ?? story.publishedAtIso,
          articleSection: categoryTopic(story.category).name,
          articleBody: story.body
            .flatMap((section) => section.paragraphs)
            .join("\n\n"),
          wordCount: story.body
            .flatMap((section) => section.paragraphs)
            .join(" ")
            .trim()
            .split(/\s+/u)
            .filter(Boolean).length,
          // `story.topics` is dominated by the article's category, so joining it
          // published `"keywords": "U.S. News"` on almost every story. The
          // queries readers actually type are the useful signal here.
          keywords: keywordsFor({
            topics: story.topics,
            secondaryQueries: story.searchQueries,
          }),
          inLanguage: "en-US",
          thumbnailUrl: image,
          timeRequired: `PT${Math.max(1, story.readTime)}M`,
          // Selectors are asserted against the rendered article in tests, so a
          // markup rename cannot silently leave assistants reading nothing.
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: [
              ".article-page__header h1",
              ".article-page__dek",
              ".full-story-panel",
            ],
          },
          isAccessibleForFree: true,
          ...(citations.length > 0 ? { citation: citations } : {}),
          author: authorEntity(story.author, origin, brand.name),
          // reviewedBy is a factual assertion that a named party checked this
          // article. It is emitted only when a real review record exists; a
          // placeholder desk here was a false claim to search engines.
          ...(story.reviewer && story.humanReviewed !== false
            ? {
                reviewedBy: authorEntity(story.reviewer, origin, brand.name),
              }
            : {}),
          isPartOf: {
            "@type": "WebSite",
            name: brand.name,
            url: origin,
          },
          publisher: {
            // Matches the homepage entity, so the publisher a crawler reads on
            // an article is the same type it reads on the site itself.
            "@type": "NewsMediaOrganization",
            name: brand.name,
            url: origin,
            logo: publisherLogo(brand.logo, origin),
          },
          about: story.topics.map((name) => ({
            "@type": "Thing",
            name,
          })),
          ...(live
            ? {
                coverageStartTime: story.publishedAtIso,
                coverageEndTime: story.updatedAtIso,
              }
            : {}),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: origin,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: categoryTopic(story.category).name,
              item: `${origin}/topics/${categoryTopic(story.category).slug}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: story.headline,
              item: canonical,
            },
          ],
        }}
      />
    </>
  );
}

function publicOrigin(): string {
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    );
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}

function absoluteUrl(value: string, origin: string): string {
  try {
    return new URL(value, `${origin}/`).toString();
  } catch {
    return `${origin}/og.png`;
  }
}

