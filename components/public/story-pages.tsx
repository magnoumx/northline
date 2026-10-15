import { Check, Clock3, FileCheck2, Newspaper, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildSourceComparison,
  getPublicContentSnapshot,
  getPublishedStory,
} from "@/lib/content";
import type { Story } from "@/lib/site/types";
import { ArticleReadingProgress } from "../article-reading-progress";
import { NewsletterForm } from "../newsletter-form";
import { PageShell } from "../page-shell";
import { ReaderActions } from "../reader-actions";
import { hasMeaningfulUpdate } from "@/lib/site/story-update";
import {
  collectLinkableEntities,
  linkifyParagraph,
  type LinkableEntity,
} from "@/lib/content/entity-links";
import {
  categoryLabel,
  StatusLabel,
  StoryCard,
  StoryMedia,
  Timeline,
  SourceStack,
} from "../story-ui";
import { StoryStructuredData } from "../structured-data";
import { StoryBreadcrumbs, toPublicSlug } from "./shared";
import { GoogleAdSlot } from "../google-ad-slot";
import { EditorialMediaEmbed } from "../editorial-media-embed";

export async function StoryIntelligencePage({ slug }: { slug: string }) {
  return <ArticlePage slug={slug} />;
}

export async function StandardArticlePage({ slug }: { slug: string }) {
  return <ArticlePage slug={slug} />;
}

async function ArticlePage({ slug }: { slug: string }) {
  const [story, snapshot] = await Promise.all([
    getPublishedStory(slug),
    getPublicContentSnapshot(),
  ]);
  if (!story) notFound();

  const articleElementId = `article-${story.slug}`;
  const updated = hasMeaningfulUpdate(story);
  const comparison = buildSourceComparison(story);
  const entities = collectLinkableEntities(snapshot.stories, {
    excludeSlug: story.slug,
  });

  return (
    <PageShell articleId={story.id}>
      <StoryStructuredData story={story} />
      <article className="article-page" id={articleElementId}>
        <ArticleReadingProgress articleElementId={articleElementId} slug={story.slug} />

        <header className="article-page__header shell article-frame">
          <StoryBreadcrumbs story={story} />
          <div className="article-page__kicker">
            <p className="story-eyebrow">{categoryLabel(story.category)}</p>
            <StatusLabel status={story.status} />
            {story.isDemo ? <span className="demo-label">Fictional demo story</span> : null}
          </div>
          <h1>{story.headline}</h1>
          <p className="article-page__dek">{story.dek}</p>
          <div className="article-page__meta">
            <span>
              By <Link href={`/authors/${slugify(story.author)}`}>{story.author}</Link>
            </span>
            {story.reviewer ? <span>Reviewed by {story.reviewer}</span> : null}
            <time dateTime={story.publishedAtIso}>Published {story.published}</time>
            {updated ? <time dateTime={story.updatedAtIso}>Updated {story.updated}</time> : null}
            <span>{story.readTime} min read</span>
          </div>

          <div className="article-page__verification">
            <span className="article-page__verified">
              <ShieldCheck aria-hidden="true" />
              {story.status === "Verified"
                ? `Verified with ${sourceCountLabel(story)}`
                : sourceCountLabel(story)}
            </span>
            {/* States how the article was actually produced. Where no human read
                it, it says so rather than implying a review that never happened. */}
            {story.workflowStatement ? (
              <details className="article-page__about-report">
                <summary>About this report</summary>
                <p>{story.workflowStatement}</p>
              </details>
            ) : null}
          </div>

          <div id="article-actions">
            <ReaderActions
              slug={story.slug}
              articleId={story.id}
              headline={story.headline}
              listenText={articleListenText(story)}
            />
          </div>
        </header>

        <div className="article-page__hero shell article-frame">
          <StoryMedia story={story} priority ratio="cinema" transition />
        </div>

        {story.videoEmbedUrl && story.videoProvider ? (
          <EditorialMediaEmbed
            embedUrl={story.videoEmbedUrl}
            sourceUrl={story.videoSourceUrl}
            provider={story.videoProvider}
            title={story.videoTitle ?? `${story.headline} source media`}
            aspect={story.videoAspect}
          />
        ) : null}

        <GoogleAdSlot
          placement="article_top"
          enabled={adsenseEnabled()}
          clientId={process.env.ADSENSE_CLIENT_ID}
          slot={process.env.ADSENSE_ARTICLE_TOP_SLOT}
          className="shell article-frame"
        />

        {story.keyFacts.length > 0 ? (
          <section className="article-in-short shell article-frame" aria-labelledby="in-short-title">
            <h2 id="in-short-title">In short</h2>
            <ul>
              {story.keyFacts.slice(0, 3).map((fact) => (
                <li key={fact}>
                  <Check aria-hidden="true" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="shell article-frame">
          <ArticleBody story={story} entities={entities} />
        </div>

        {updated ? (
          <section className="article-update-summary shell article-frame" aria-labelledby="article-update-summary-title">
            <Clock3 aria-hidden="true" />
            <div>
              <p>Updated</p>
              <h2 id="article-update-summary-title">This story has new verified information.</h2>
              <p>Published {story.published}, last updated {story.updated}.</p>
            </div>
          </section>
        ) : null}

        <GoogleAdSlot
          placement="article_mid"
          enabled={adsenseEnabled()}
          clientId={process.env.ADSENSE_CLIENT_ID}
          slot={process.env.ADSENSE_ARTICLE_MID_SLOT}
          className="shell article-frame"
        />

        <section className="article-verification shell article-frame" aria-labelledby="article-verification-title">
          <details className="article-verification__details">
            <summary>
              <FileCheck2 aria-hidden="true" />
              <span>
                <p id="article-verification-title">How we verified this story</p>
                <strong>{sourceCountLabel(story)}</strong>
              </span>
            </summary>
            <div className="article-verification__panel">
              <SourceStack story={story} />
              {comparison.length ? (
                <details className="coverage-comparison">
                  <summary>Compare source coverage</summary>
                  <div className="coverage-comparison__list">
                    {comparison.map((row) => (
                      <article key={row.source}>
                        <h3>{row.source}</h3>
                        <dl>
                          <div>
                            <dt>Focus</dt>
                            <dd>{row.focus}</dd>
                          </div>
                          <div>
                            <dt>What it adds</dt>
                            <dd>{row.adds}</dd>
                          </div>
                          <div>
                            <dt>What it does not establish</dt>
                            <dd>{row.omits}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </details>
        </section>

        {story.topics.length > 0 ? (
          <nav className="article-tags shell article-frame" aria-label="Topics in this story">
            <span className="article-tags__label">Topics</span>
            <ul>
              {story.topics.map((topic) => (
                <li key={topic}>
                  <Link href={`/topics/${toPublicSlug(topic)}`}>{topic}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <section className="article-related shell article-frame" aria-labelledby="related-coverage-title">
          <div className="article-related__heading">
            <div>
              <p>Related</p>
              <h2 id="related-coverage-title">More reporting and context</h2>
            </div>
            <Newspaper aria-hidden="true" />
          </div>
          <div className="article-related__grid">
            {/* Ranked by what the stories actually share - topics first, then
                category, then recency. Six rather than three: on a new site
                most articles are only reachable through the sitemap, and a
                denser web of internal links is the strongest on-site signal
                for getting them crawled and out of "discovered, not indexed". */}
            {rankRelatedStories(story, snapshot.stories)
              .slice(0, 6)
              .map((candidate) => (
                <StoryCard key={candidate.slug} story={candidate} variant="horizontal" titleLevel={3} />
              ))}
          </div>
        </section>

        <GoogleAdSlot
          placement="article_end"
          enabled={adsenseEnabled()}
          clientId={process.env.ADSENSE_CLIENT_ID}
          slot={process.env.ADSENSE_ARTICLE_END_SLOT}
          className="shell article-frame"
        />

        <section className="article-newsletter shell article-frame" aria-labelledby="article-newsletter-title">
          <div>
            <p>Northline newsletter</p>
            <h2 id="article-newsletter-title">A clearer way to keep up.</h2>
            <span>One concise briefing, with the context behind the headlines.</span>
          </div>
          <NewsletterForm />
        </section>
      </article>
    </PageShell>
  );
}

function InlineFigure({
  item,
}: {
  item: NonNullable<Story["inlineMedia"]>[number];
}) {
  return (
    <figure className="article-inline-media">
      {/* Intrinsic size lets the browser reserve the box before the image
          arrives. Without it every inline photo shifted the text below it,
          which counts against the page's Cumulative Layout Shift. */}
      <img
        src={item.url}
        alt={item.alt}
        width="1600"
        height="900"
        loading="lazy"
        decoding="async"
      />
      {item.caption ? (
        <figcaption>
          {item.caption}
          {item.sourceUrl ? (
            <>
              {" "}
              <a href={item.sourceUrl} rel="noopener noreferrer nofollow">
                Source
              </a>
            </>
          ) : null}
          {item.license && item.licenseUrl ? (
            <>
              {" · "}
              <a href={item.licenseUrl} rel="noopener noreferrer nofollow">
                {item.license}
              </a>
            </>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

function ProseParagraph({
  paragraph,
  entities,
  used,
}: {
  paragraph: string;
  entities: readonly LinkableEntity[];
  used: Set<string>;
}) {
  const segments = linkifyParagraph(paragraph, entities, used);
  return (
    <p>
      {segments.map((segment, index) =>
        segment.kind === "link" ? (
          <Link
            className="prose-link"
            href={segment.href}
            key={`${segment.value}-${index}`}
          >
            {segment.value}
          </Link>
        ) : (
          <span key={`t-${index}`}>{segment.value}</span>
        ),
      )}
    </p>
  );
}

/**
 * The reporting itself: normal readable paragraphs, no tab to switch to.
 * "Full Story" used to be one of five tabs a reader had to find first; here
 * it just is the article, immediately below the In Short bullets.
 */
function ArticleBody({
  story,
  entities,
}: {
  story: Story;
  entities: readonly LinkableEntity[];
}) {
  const inline = story.inlineMedia ?? [];
  // Shared across the whole article so a subject is linked once, on its first
  // mention, rather than in every paragraph that names it.
  const used = new Set<string>();
  return (
    <div className="full-story-panel">
      {story.body.map((section, index) => (
        <section key={section.heading ?? index}>
          {section.heading ? <h2>{section.heading}</h2> : null}
          {section.paragraphs.map((paragraph) => (
            <ProseParagraph
              entities={entities}
              key={paragraph}
              paragraph={paragraph}
              used={used}
            />
          ))}
          {/* Imagery of the event sits with the passage it belongs to, which is
              where a reader looks for it, rather than stacked above the lede. */}
          {inline
            .filter((item) => item.afterSection === index + 1)
            .map((item) => (
              <InlineFigure key={item.url} item={item} />
            ))}
        </section>
      ))}
      <section className="article-context-callout">
        <h2>Why it matters</h2>
        <p>{story.whyItMatters}</p>
      </section>
      {story.timeline.length ? (
        <section className="article-view-section" aria-labelledby="article-timeline-title">
          <div className="article-view-section__heading">
            <Clock3 aria-hidden="true" />
            <div>
              <p>Timeline</p>
              <h2 id="article-timeline-title">How the story developed</h2>
            </div>
          </div>
          <Timeline items={story.timeline} />
        </section>
      ) : null}
      {/* The one section that changes register. Publishing what could not be
          established is the most distinctive thing this newsroom does, and it
          was previously indistinguishable from any other heading in the flow. */}
      <section className="article-uncertainties">
        <h2>What remains unclear</h2>
        {story.uncertainties.length ? (
          <ul>
            {story.uncertainties.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No material conflict is recorded in this report.</p>
        )}
      </section>
      <section>
        <h2>What happens next</h2>
        <p>{story.next}</p>
      </section>
    </div>
  );
}

function articleListenText(story: Story) {
  return [
    story.headline,
    story.dek,
    story.summary,
    ...story.body.flatMap((section) => section.paragraphs),
    `Why it matters. ${story.whyItMatters}`,
    `What happens next. ${story.next}`,
  ].join(" ");
}

function sourceCountLabel(story: Story): string {
  const count = story.sources.length;
  return `${count} source${count === 1 ? "" : "s"}`;
}

/**
 * Orders the archive by how closely each story relates to this one.
 *
 * The grid previously showed the three newest articles under a "Related
 * coverage" heading, which was a claim the selection could not support. Topics
 * now exist for every article, so relatedness can be measured instead of
 * asserted.
 */
function rankRelatedStories(story: Story, candidates: Story[]): Story[] {
  const topics = new Set(story.topics.map((topic) => topic.toLowerCase()));
  return candidates
    .filter((candidate) => candidate.slug !== story.slug)
    .map((candidate) => {
      const shared = candidate.topics.filter((topic) =>
        topics.has(topic.toLowerCase()),
      ).length;
      const sameCategory = candidate.category === story.category ? 1 : 0;
      const published = candidate.publishedAtIso
        ? Date.parse(candidate.publishedAtIso)
        : 0;
      return { candidate, shared, sameCategory, published };
    })
    // A shared subject outranks a shared section, and recency only breaks ties.
    .sort(
      (left, right) =>
        right.shared - left.shared ||
        right.sameCategory - left.sameCategory ||
        right.published - left.published,
    )
    .map((entry) => entry.candidate);
}

function slugify(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function adsenseEnabled(): boolean {
  return (
    process.env.FEATURE_ADSENSE === "true" &&
    process.env.AD_GLOBAL_KILL === "false" &&
    process.env.ADSENSE_CONSENT_READY === "true"
  );
}
