import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  articles,
  articleVersions,
  sources,
  storyClusters,
  trends,
  users,
} from "../../db/schema";
import {
  articleAssignments,
  articleMedia,
  articleSourceLinks,
  articleTopics,
  contentTopics,
  mediaAssets,
} from "../../db/schema-v3-content";
import { getDb } from "../../db";
import type { Story, StoryFormat, StoryStatus, Trend } from "../site/types";
import { normalizeEditorialEmbed } from "../media/editorial-embeds";
import { describeWorkflow } from "./workflow-disclosure";
import {
  PUBLIC_ARTICLE_STATES,
  type PublicContentRepository,
} from "./types";

type Database = Awaited<ReturnType<typeof getDb>>;

export function createD1PublicContentRepository(
  database?: Database,
): PublicContentRepository {
  let dbPromise: Promise<Database> | undefined = database
    ? Promise.resolve(database)
    : undefined;
  const db = () => (dbPromise ??= getDb());

  return {
    async listPublishedStories(limit = 50) {
      const rows = await queryStoryRows(await db(), boundedLimit(limit));
      return hydrateStories(await db(), rows);
    },
    /**
     * A real page of the archive, not the homepage's capped snapshot.
     *
     * `getPublicContentSnapshot` caps at 60 for the surfaces that only need a
     * recent window - the homepage hero, related stories, most-read ranking.
     * `/latest` used that same capped list directly with no pagination, so
     * the moment the archive passed 60 articles, everything older had no
     * path a reader or crawler could browse to; only the sitemap still knew
     * it existed.
     */
    async listPublishedStoriesPage({ offset = 0, limit = 24 }) {
      const database = await db();
      const boundedPageLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
      const boundedOffset = Math.max(0, Math.trunc(offset));
      const [rows, [{ total }]] = await Promise.all([
        queryStoryRows(database, boundedPageLimit, undefined, boundedOffset),
        database
          .select({ total: sql<number>`COUNT(*)` })
          .from(articles)
          .where(inArray(articles.state, [...PUBLIC_ARTICLE_STATES])),
      ]);
      const stories = await hydrateStories(database, rows);
      return { stories, total: Number(total) };
    },
    /**
     * Slug and timestamps only. The sitemap does not need bodies, sources or
     * media, and hydrating them capped the archive at the snapshot size.
     */
    async listPublishedStoryIndex() {
      const rows = await (await db())
        .select({
          slug: articles.slug,
          category: articles.category,
          publishedAt: articles.publishedAt,
          updatedAt: articles.updatedAt,
        })
        .from(articles)
        .where(inArray(articles.state, [...PUBLIC_ARTICLE_STATES]))
        .orderBy(desc(articles.publishedAt), desc(articles.updatedAt));

      return rows.map((row) => ({
        slug: row.slug,
        category: row.category,
        publishedAtIso: row.publishedAt ? row.publishedAt.toISOString() : null,
        updatedAtIso: row.updatedAt ? row.updatedAt.toISOString() : null,
      }));
    },
    async findPublishedStoryBySlug(slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
      const rows = await queryStoryRows(await db(), 1, slug);
      const hydrated = await hydrateStories(await db(), rows);
      return hydrated[0] ?? null;
    },
    /**
     * Measured readership over a stated window.
     *
     * Counts distinct readers rather than events, and counts reading signals
     * rather than page views: an arrival is not a read.
     */
    async listMostReadArticleIds(periodHours = 48) {
      const since = Date.now() - periodHours * 60 * 60 * 1000;
      const rows = await (await db()).all<{ articleId: string; readers: number }>(
        sql`SELECT article_id AS articleId,
                   COUNT(DISTINCT COALESCE(anonymous_id_hash, id)) AS readers
            FROM analytics_events
            WHERE article_id IS NOT NULL
              AND occurred_at >= ${since}
              AND event_type IN ('ENGAGED_READING', 'ARTICLE_COMPLETION')
            GROUP BY article_id
            ORDER BY readers DESC
            LIMIT 25`,
      );
      return rows.map((row) => ({
        articleId: row.articleId,
        readers: Number(row.readers),
      }));
    },
    async listPublishedTrends(limit = 10) {
      const rows = await (await db())
        .select({
          rank: trends.score,
          term: trends.originalTerm,
          category: trends.category,
          velocity: trends.searchVelocity,
          regionsJson: trends.geographicMarket,
          explanationJson: trends.scoreExplanationJson,
          clusterSlug: storyClusters.slug,
        })
        .from(trends)
        .leftJoin(storyClusters, eq(trends.storyClusterId, storyClusters.id))
        .where(
          and(
            inArray(trends.editorialState, [
              "CANDIDATE",
              "RESEARCHING",
              "RESEARCH_COMPLETE",
              "PUBLISHED",
              "DEVELOPING",
              "UPDATED",
            ]),
            eq(trends.geographicMarket, "US"),
          ),
        )
        .orderBy(desc(trends.score), desc(trends.latestDetectedAt))
        .limit(boundedLimit(limit));
      return rows.map(
        (row, index): Trend => ({
          rank: index + 1,
          term: row.term,
          category: row.category,
          velocity: row.velocity,
          regions: row.regionsJson === "US" ? ["United States"] : [row.regionsJson],
          explanation: readExplanation(row.explanationJson),
          confidence: row.velocity >= 70 ? "High" : "Medium",
          related: [],
          storySlug: row.clusterSlug ?? undefined,
        }),
      );
    },
  };
}

async function queryStoryRows(
  db: Database,
  limit: number,
  slug?: string,
  offset = 0,
) {
  return db
    .select({
      articleId: articles.id,
      slug: articles.slug,
      category: articles.category,
      format: articles.format,
      state: articles.state,
      sensitive: articles.sensitive,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      versionId: articleVersions.id,
      headline: articleVersions.headline,
      subheadline: articleVersions.subheadline,
      bodyJson: articleVersions.bodyJson,
      takeawaysJson: articleVersions.keyTakeawaysJson,
      seoJson: articleVersions.seoJson,
      structuredDataJson: articleVersions.structuredDataJson,
      versionPublishedAt: articleVersions.publishedAt,
      authorName: users.displayName,
    })
    .from(articles)
    .innerJoin(
      articleVersions,
      eq(articles.currentVersionId, articleVersions.id),
    )
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(
      and(
        inArray(articles.state, [...PUBLIC_ARTICLE_STATES]),
        slug ? eq(articles.slug, slug) : undefined,
      ),
    )
    .orderBy(desc(articles.publishedAt), desc(articles.updatedAt))
    .limit(limit)
    .offset(offset);
}

type StoryRow = Awaited<ReturnType<typeof queryStoryRows>>[number];

async function hydrateStories(
  db: Database,
  rows: StoryRow[],
): Promise<Story[]> {
  if (rows.length === 0) return [];
  const articleIds = rows.map((row) => row.articleId);
  const versionIds = rows.map((row) => row.versionId);

  const [topicRows, sourceRows, mediaRows, reviewerRows] = await Promise.all([
    db
      .select({
        articleId: articleTopics.articleId,
        name: contentTopics.name,
      })
      .from(articleTopics)
      .innerJoin(contentTopics, eq(articleTopics.topicId, contentTopics.id))
      .where(
        and(
          inArray(articleTopics.articleId, articleIds),
          eq(contentTopics.active, true),
        ),
      )
      .orderBy(asc(contentTopics.name)),
    db
      .select({
        versionId: articleSourceLinks.articleVersionId,
        id: sources.id,
        name: sources.name,
        relationship: articleSourceLinks.relationship,
        tier: sources.credibilityTier,
        note: articleSourceLinks.summary,
        documentUrl: articleSourceLinks.sourceUrl,
        documentTitle: articleSourceLinks.sourceTitle,
      })
      .from(articleSourceLinks)
      .innerJoin(sources, eq(articleSourceLinks.sourceId, sources.id))
      .where(inArray(articleSourceLinks.articleVersionId, versionIds))
      .orderBy(asc(articleSourceLinks.citationOrder)),
    db
      .select({
        versionId: articleMedia.articleVersionId,
        role: articleMedia.role,
        position: articleMedia.position,
        url: mediaAssets.publicUrl,
        altText: articleMedia.altText,
        caption: articleMedia.caption,
        attribution: mediaAssets.attribution,
        originalUrl: mediaAssets.originalUrl,
        license: mediaAssets.license,
        licenseUrl: mediaAssets.licenseUrl,
      })
      .from(articleMedia)
      .innerJoin(mediaAssets, eq(articleMedia.mediaAssetId, mediaAssets.id))
      .where(
        and(
          inArray(articleMedia.articleVersionId, versionIds),
          eq(mediaAssets.workflowState, "APPROVED"),
          eq(mediaAssets.verificationState, "VERIFIED"),
        ),
      ),
    db
      .select({
        articleId: articleAssignments.articleId,
        name: users.displayName,
      })
      .from(articleAssignments)
      .innerJoin(users, eq(articleAssignments.userId, users.id))
      .where(
        and(
          inArray(articleAssignments.articleId, articleIds),
          eq(articleAssignments.role, "REVIEWER"),
        ),
      ),
  ]);

  return rows.map((row) => {
    const seo = safeRecord(row.seoJson);
    const structured = safeRecord(row.structuredDataJson);
    const body = readBody(row.bodyJson);
    const topics = topicRows
      .filter((topic) => topic.articleId === row.articleId)
      .map((topic) => topic.name);
    const linkedSources = sourceRows
      .filter((source) => source.versionId === row.versionId)
      .map((source) => ({
        id: source.id,
        // A reader must be able to open the exact page that supports the
        // claim. The publisher profile is only the fallback for legacy rows
        // recorded before citations stored their document.
        locator: readCitationLocator(source.documentUrl, source.id),
        name: source.documentTitle ?? source.name,
        kind: sourceKind(source.relationship),
        tier: clampTier(source.tier),
        note: source.note,
      }));
    const versionMedia = mediaRows.filter(
      (candidate) => candidate.versionId === row.versionId,
    );
    const media = pickHero(versionMedia);
    // Everything that is not the hero runs inside the reporting, spaced through
    // the body rather than stacked above it.
    const inlineMedia = versionMedia
      .filter((candidate) => candidate.role !== "HERO" && servableImageUrl(candidate.url))
      .map((candidate, index) => ({
        url: servableImageUrl(candidate.url) as string,
        alt: candidate.altText ?? row.headline,
        caption: candidate.caption ?? candidate.attribution ?? "",
        sourceUrl: candidate.originalUrl ?? undefined,
        license: candidate.license ?? undefined,
        licenseUrl: candidate.licenseUrl ?? undefined,
        afterSection: Number(candidate.position ?? index) || index + 1,
      }));
    const reviewer = reviewerRows.find(
      (candidate) => candidate.articleId === row.articleId,
    )?.name;
    const workflow = describeWorkflow({
      author: row.authorName ?? null,
      humanReviewer: reviewer ?? null,
      approvedBy: null,
      draftingProvider: stringValue(structured.draftingProvider) ?? null,
      factReviewProvider: stringValue(structured.factReviewProvider) ?? null,
    });
    const publishedAt =
      row.versionPublishedAt ?? row.publishedAt ?? row.updatedAt ?? new Date(0);
    const updatedAt = row.updatedAt ?? publishedAt;
    const summary = stringValue(seo.summary) ?? row.subheadline ?? row.headline;
    const takeaways = stringArray(row.takeawaysJson);

    return {
      id: row.articleId,
      slug: row.slug,
      category: row.category,
      eyebrow: stringValue(seo.eyebrow) ?? row.category,
      headline: row.headline,
      dek: row.subheadline ?? summary,
      summary,
      status: publicStatus(row.state),
      format: publicFormat(row.format),
      published: formatDate(publishedAt),
      updated: formatDate(updatedAt),
      publishedAtIso: publishedAt.toISOString(),
      updatedAtIso: updatedAt.toISOString(),
      canonicalPath: `/story/${row.slug}`,
      readTime: estimateReadTime(body),
      // The last resort used to be the 2.6 MB social card, which became the
      // visible hero and the mobile LCP image. The generated editorial graphic
      // is an SVG of about 2 KB and is the correct reader-facing fallback; the
      // social card is still used for og:image, where SVG is not supported.
      image:
        servableImageUrl(media?.url) ??
        servableImageUrl(readerImage(stringValue(structured.image))) ??
        `/story-image/${row.slug}`,
      imageAlt:
        media?.altText ??
        stringValue(structured.imageAlt) ??
        row.headline,
      imageCredit:
        media?.attribution ??
        media?.caption ??
        stringValue(structured.imageCredit) ??
        "",
      // CC BY and CC BY-SA require attribution with a link to the source and
      // the licence, so those exact fields travel to the rendered page.
      inlineMedia,
      imageSourceUrl: media?.originalUrl ?? undefined,
      imageLicense: media?.license ?? undefined,
      imageLicenseUrl: media?.licenseUrl ?? undefined,
      ...(() => {
        const embed = normalizeEditorialEmbed(
          stringValue(structured.videoSourceUrl) ??
            stringValue(structured.videoEmbedUrl),
          stringValue(structured.videoTitle) ?? `${row.headline} source media`,
        );
        return embed
          ? {
              videoEmbedUrl: embed.embedUrl,
              videoTitle: embed.title,
              videoProvider: embed.provider,
              videoSourceUrl: embed.sourceUrl,
              videoAspect: embed.aspect,
            }
          : {};
      })(),
      accent: "blue" as const,
      score: 0,
      trend: 0,
      author: row.authorName ?? "Editorial Desk",
      // No placeholder. A reviewer is named only when a review record names
      // one; otherwise the article states that no human reviewed it.
      reviewer: reviewer ?? null,
      workflowStatement: workflow.statement,
      humanReviewed: workflow.humanReviewed,
      topics,
      // What readers actually type. Carried through so structured data can
      // publish real keywords instead of the article's category.
      searchQueries: [
        ...(stringValue(seo.primaryQuery) ? [stringValue(seo.primaryQuery)!] : []),
        ...stringArrayValue(seo.secondaryQueries),
      ],
      whyItMatters: stringValue(seo.whyItMatters) ?? summary,
      whyTrending: stringValue(seo.whyTrending) ?? "",
      keyFacts: takeaways,
      body,
      timeline: [],
      sources: linkedSources,
      uncertainties: stringArrayValue(seo.uncertainties),
      next: stringValue(seo.whatHappensNext) ?? "",
      isDemo: false,
    };
  });
}

/**
 * The 1200x630 social card is not article media. Some migrated stories stored it
 * as their image, which made a 2.6 MB asset the visible hero and the mobile LCP
 * element, so it is rejected here in favour of the light editorial graphic.
 */
/** Only an absolute HTTPS document may replace the internal profile link. */
/**
 * Ten published articles carry two HERO rows: the house graphic and an older
 * AI illustration left behind by an earlier pass. Media on a published version
 * is immutable by design, so both rows are permanent - which means the page has
 * to choose, and choosing with `.find()` over an unordered result meant the same
 * article could render either image depending on which row D1 returned first.
 *
 * The order is the editorial preference: a licensed photograph outranks the
 * house graphic, and the house graphic outranks an AI illustration, which policy
 * already treats as the last resort. The URL breaks a remaining tie so the
 * result is stable rather than merely usually-stable.
 */
function heroRank(candidate: {
  license: string | null;
  url: string | null;
}): number {
  if (candidate.license === "AI_GENERATED") return 2;
  if (candidate.url?.startsWith("/story-image/")) return 1;
  return 0;
}

export function pickHero<
  T extends { role: string; license: string | null; url: string | null },
>(versionMedia: readonly T[]): T | undefined {
  return versionMedia
    .filter((candidate) => candidate.role === "HERO")
    .sort(
      (a, b) =>
        heroRank(a) - heroRank(b) || (a.url ?? "").localeCompare(b.url ?? ""),
    )[0];
}

function readCitationLocator(
  documentUrl: string | null,
  sourceId: string,
): `/sources/${string}` | `https://${string}` {
  const trimmed = documentUrl?.trim() ?? "";
  if (trimmed.startsWith("https://") && trimmed.length <= 2_000) {
    return trimmed as `https://${string}`;
  }
  return `/sources/${sourceId}`;
}

/**
 * Hosts the Content-Security-Policy lets the page load images from. A stored URL
 * on any other host is not a slightly worse image, it is a broken one: the
 * browser refuses it and the card shows alt text where the picture should be.
 */
const SERVABLE_IMAGE_HOSTS = new Set([
  "upload.wikimedia.org",
  "images.unsplash.com",
]);

export function servableImageUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  // Our own graphics are same-origin paths and always load.
  if (value.startsWith("/")) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  // Commons hands out thumbnail links on thumb.wikimedia.org that serve the
  // same bytes as upload.wikimedia.org, which is the host the policy allows.
  if (url.hostname === "thumb.wikimedia.org") {
    url.hostname = "upload.wikimedia.org";
  }
  if (!SERVABLE_IMAGE_HOSTS.has(url.hostname)) return undefined;
  // The utm_* tracking suffix Commons appends is noise in a page-embedded image.
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_")) url.searchParams.delete(key);
  }
  return url.toString();
}

function readerImage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const path = value.split("?")[0]?.toLowerCase() ?? "";
  return path.endsWith("/og.png") || path === "og.png" ? undefined : value;
}

function boundedLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function publicStatus(state: string): StoryStatus {
  if (state === "UPDATED" || state === "CORRECTED") return "Updated";
  return "Verified";
}

function publicFormat(format: string): StoryFormat {
  if (
    format === "Quick Brief" ||
    format === "Standard" ||
    format === "Deep Explainer" ||
    format === "Live Blog" ||
    format === "Why Trending"
  ) {
    return format;
  }
  return "Standard";
}

function sourceKind(
  relationship: string,
): "Primary" | "Independent" | "Context" {
  if (relationship === "PRIMARY") return "Primary";
  if (relationship === "INDEPENDENT") return "Independent";
  return "Context";
}

function clampTier(value: number): 1 | 2 | 3 {
  if (value <= 1) return 1;
  if (value === 2) return 2;
  return 3;
}

function readBody(value: string): Story["body"] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      const paragraphs = Array.isArray(record.paragraphs)
        ? record.paragraphs.filter(
            (paragraph): paragraph is string => typeof paragraph === "string",
          )
        : [];
      if (paragraphs.length === 0) return [];
      return [
        {
          ...(typeof record.heading === "string"
            ? { heading: record.heading }
            : {}),
          paragraphs,
        },
      ];
    });
  } catch {
    return [];
  }
}

function stringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function safeRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function estimateReadTime(body: Story["body"]): number {
  const words = body
    .flatMap((section) => section.paragraphs)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 225));
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(value);
}

function readExplanation(value: string): string {
  const record = safeRecord(value);
  return (
    stringValue(record.publicExplanation) ??
    stringValue(record.summary) ??
    "Interest is rising across configured source signals."
  );
}
