import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  DirectoryPage,
  LatestPage,
  LiveBlogPage,
  LiveIndexPage,
  NewsletterPage,
  PersonalPage,
  PolicyPage,
  SearchPage,
  StandardArticlePage,
  StoryIntelligencePage,
  TopicPage,
  TrendingPage,
} from "@/components/public-pages";
import {
  AdvertisePage,
  AdvertisingRequestPage,
  MediaKitPage,
  MembershipPage,
  SponsoredPage,
} from "@/components/advertising/commercial-pages";
import { getBrandConfig } from "@/lib/brand/config";
import { getPublicContentSnapshot, getPublishedStory } from "@/lib/content";
import { toPublicSlug } from "@/components/public/shared";
import {
  PERSONAL_NOINDEX_ROUTES,
  publicRouteMetadata,
} from "@/lib/site/public-routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CatchAllProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const policies = new Set([
  "about",
  "contact",
  "editorial-standards",
  "ai-policy",
  "corrections",
  "ownership",
  "funding",
  "sponsored-content-policy",
  "security",
  "privacy",
  "cookies",
  "terms",
]);

const directories = new Set([
  "topics",
  "sources",
  "authors",
  "people",
  "companies",
  "teams",
]);

export async function generateMetadata({
  params,
}: CatchAllProps): Promise<Metadata> {
  const { slug } = await params;
  const [root, second, third] = slug;
  if (
    root === "story" ||
    root === "explainers" ||
    root === "visuals" ||
    root === "video" ||
    root === "live"
  ) {
    const story = await getPublishedStory(second);
    if (story) {
      return storyMetadata(story);
    }
  }
  if (root === "news" && third) {
    const story = await getPublishedStory(third);
    if (story) {
      return storyMetadata(story);
    }
  }
  const routeKey = slug.join("/");
  const defined = publicRouteMetadata(routeKey);
  if (defined) {
    return defined;
  }
  if (root === "topics" && second) {
    const topicName = readableName(second);
    // A topic page holding one article is a duplicate of that article with 84
    // words around it. Forty-three of them existed, all `index, follow`, all
    // linked from every article - so they competed for crawl budget against the
    // reporting itself on a domain where Google had discovered 82 URLs and
    // crawled none of them. Below the threshold the page still works for a
    // reader who clicks a tag; it just stops asking to be indexed.
    const coverage = await countPublishedStoriesForTopic(second);
    const thin = coverage < MINIMUM_INDEXABLE_TOPIC_STORIES;
    return {
      title: `${topicName} news and explainers`,
      description: `Verified reporting, context, and updates about ${topicName}.`,
      alternates: thin ? undefined : { canonical: `/topics/${second}` },
      // Spread rather than `robots: undefined`. Next.js treats an explicit
      // undefined as "clear the inherited value", which stripped the root
      // layout's directives from every healthy topic page - including
      // max-image-preview:large, the setting Google Discover requires for a
      // large card. Omitting the key entirely is what actually inherits.
      ...(thin ? { robots: { index: false, follow: true } } : {}),
    };
  }
  const readable = (second ?? root)
    ? readableName(second ?? root)
    : "News";
  const noindex = PERSONAL_NOINDEX_ROUTES.has(root);
  return {
    title: readable,
    alternates: noindex ? undefined : { canonical: `/${slug.join("/")}` },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

/**
 * How many published articles a topic needs before its page is worth indexing.
 * Three is the point where the page starts being a list rather than a mirror of
 * a single story.
 */
const MINIMUM_INDEXABLE_TOPIC_STORIES = 3;

async function countPublishedStoriesForTopic(slug: string): Promise<number> {
  const { stories } = await getPublicContentSnapshot();
  return stories.filter((story) =>
    story.topics.some((topic) => toPublicSlug(topic) === slug),
  ).length;
}

function storyMetadata(
  story: NonNullable<Awaited<ReturnType<typeof getPublishedStory>>>,
): Metadata {
  const canonical = story.canonicalPath ?? `/story/${story.slug}`;
  return {
    title: story.headline,
    description: story.dek,
    authors: [{ name: story.author }],
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: story.headline,
      description: story.dek,
      url: canonical,
      publishedTime: story.publishedAtIso,
      modifiedTime: story.updatedAtIso,
      section: story.category,
      tags: story.topics,
      images: [{ url: socialPreviewImage(story.image), alt: story.imageAlt }],
    },
  };
}

/**
 * Social crawlers do not render SVG link previews, and the generated house
 * artwork is SVG. A story with a licensed raster hero keeps that image; anything
 * else falls back to the site card so the preview is never blank.
 */
function socialPreviewImage(image: string): string {
  const withoutQuery = image.split("?")[0]?.toLowerCase() ?? "";
  const isSvg =
    withoutQuery.endsWith(".svg") || withoutQuery.startsWith("/story-image/");
  return isSvg ? "/og.png" : image;
}

function readableName(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function CatchAllPage({
  params,
  searchParams,
}: CatchAllProps) {
  const { slug } = await params;
  const query = await searchParams;
  const [root, second, third] = slug;

  if (root === "latest" && slug.length === 1) return <LatestPage />;
  if (root === "trending" && slug.length === 1) return <TrendingPage />;
  if (root === "search" && slug.length === 1) {
    const raw = query.q;
    return <SearchPage query={Array.isArray(raw) ? raw[0] : raw} />;
  }
  if (root === "newsletter" && slug.length === 1) return <NewsletterPage />;
  if (root === "newsletters" && slug.length <= 2) return <NewsletterPage />;
  if (root === "advertise" && slug.length === 1) return <AdvertisePage />;
  if (root === "advertise" && second === "media-kit" && slug.length === 2) {
    return <MediaKitPage />;
  }
  if (root === "advertise" && second === "request" && slug.length === 2) {
    return <AdvertisingRequestPage />;
  }
  if (root === "sponsored" && slug.length === 1) return <SponsoredPage />;
  if (root === "membership" && slug.length === 1) return <MembershipPage />;
  if (root === "live" && slug.length === 1) return <LiveIndexPage />;
  if (root === "live" && second && slug.length === 2) {
    if (!(await getPublishedStory(second))) notFound();
    return <LiveBlogPage slug={second} />;
  }
  if (root === "story" && second && slug.length === 2) {
    if (!(await getPublishedStory(second))) notFound();
    return <StoryIntelligencePage slug={second} />;
  }
  // One article, one URL. These paths each served a full 200 copy of the same
  // story, so a single article existed at six addresses and split its ranking
  // signals six ways. A canonical tag is a hint; a 301 is the instruction.
  if (
    (root === "explainers" || root === "visuals" || root === "video") &&
    second &&
    slug.length === 2
  ) {
    if (!(await getPublishedStory(second))) notFound();
    permanentRedirect(`/story/${second}`);
  }
  if (root === "news" && second && third && slug.length === 3) {
    const story = await getPublishedStory(third);
    if (!story || categorySlug(story.category) !== second) notFound();
    permanentRedirect(`/story/${third}`);
  }
  if (root === "topics" && second && slug.length === 2) {
    return <TopicPage slug={second} />;
  }
  if (directories.has(root) && slug.length <= 2) {
    return (
      <DirectoryPage
        type={
          root as
            | "topics"
            | "sources"
            | "authors"
            | "people"
            | "companies"
            | "teams"
        }
        slug={second}
      />
    );
  }
  if (
    (root === "saved" || root === "following" || root === "account") &&
    slug.length === 1
  ) {
    return <PersonalPage type={root} />;
  }
  if (policies.has(root) && slug.length === 1) return <PolicyPage slug={root} />;
  if (
    (root === "maintenance" || root === "offline" || root === "410") &&
    slug.length === 1
  ) {
    return <StatePage state={root} />;
  }
  notFound();
}

function categorySlug(category: string): string {
  return category.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function StatePage({ state }: { state: string }) {
  const brand = getBrandConfig();
  const copy =
    state === "maintenance"
      ? [
          "Scheduled maintenance",
          `${brand.shortName} is completing a careful systems check. Publishing is paused until every service is healthy.`,
        ]
      : state === "offline"
        ? [
            "You appear to be offline",
            "Reconnect to load verified updates. A production offline cache remains a documented release requirement, not an active feature in this preview.",
          ]
        : [
            "This story is no longer available",
            "A withdrawn or retired page preserves its status instead of quietly redirecting to unrelated coverage.",
          ];
  return (
    <main className="system-state">
      <Link className="system-state__brand" href="/">
        {brand.shortName.slice(0, 1)} <span>{brand.wordmark}</span>
      </Link>
      <div>
        <span>{state === "410" ? "410" : "STATUS"}</span>
        <h1>{copy[0]}</h1>
        <p>{copy[1]}</p>
        <Link href="/">Return to {brand.shortName}</Link>
      </div>
    </main>
  );
}
