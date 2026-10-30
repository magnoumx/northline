/* eslint-disable @next/next/no-img-element -- thumbnails use credited remote demo media */
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  FileCheck2,
  Radio,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicContentSnapshot,
  getPublishedStoriesPage,
  getPublishedStory,
} from "@/lib/content";
import { NewsletterForm } from "../newsletter-form";
import { PageShell } from "../page-shell";
import { LocalFollowButton } from "../reader-actions";
import { distinctSubjects } from "@/lib/site/search-suggestions";
import {
  EvidenceMark,
  StatusLabel,
  StoryCard,
  trendDisplayTerm, trendLabel,
  categoryLabel,
} from "../story-ui";
import { StoryStructuredData } from "../structured-data";
import { DemoDataNote, PageIntro, toPublicSlug } from "./shared";
import { categoryTopic } from "@/lib/editorial/topic-derivation";

/** Older than this, an article is reachable only through the archive pager. */
const LATEST_PAGE_SIZE = 24;

export async function LatestPage({ page = 1 }: { page?: number } = {}) {
  // The homepage snapshot caps at 60 stories - the right size for a hero and
  // a related-stories rail, wrong for "browse everything". `/latest` used
  // that same capped list directly with no pagination, so once the archive
  // passed 60 articles, everything older had no path a reader or crawler
  // could browse to; only the sitemap still knew it existed.
  const currentPage = Math.max(1, Math.trunc(page));
  const [{ mode, stories: snapshotStories }, { stories, total }] = await Promise.all([
    getPublicContentSnapshot(),
    getPublishedStoriesPage({
      offset: (currentPage - 1) * LATEST_PAGE_SIZE,
      limit: LATEST_PAGE_SIZE,
    }),
  ]);
  const topStories = snapshotStories.slice(0, 3);
  const totalPages = Math.max(1, Math.ceil(total / LATEST_PAGE_SIZE));
  if (currentPage > 1 && stories.length === 0) notFound();

  const latestDate = stories[0]?.publishedAtIso
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "America/New_York",
      }).format(new Date(stories[0].publishedAtIso))
    : "No publication date";
  const pagePath = (target: number) =>
    target <= 1 ? "/latest" : `/latest/page/${target}`;
  return (
    <PageShell>
      <PageIntro
        eyebrow="LATEST"
        title="Everything, newest first"
        description="Everything Northline published, newest first."
        aside={mode === "DEMO_FIXTURES" ? <DemoDataNote /> : undefined}
      />
      <div className="shell latest-page__layout section-space">
        <section className="latest-page" aria-label="Latest stories">
          <div className="latest-page__date">
            <span>{currentPage === 1 ? latestDate : `Page ${currentPage} of ${totalPages}`}</span>
            <small>{total ? `${total} published stories` : "No published stories"}</small>
          </div>
          <div className="latest-page__feed">
            {stories.length === 0 ? (
              <div className="public-empty-state">
                <h2>No published stories yet</h2>
                <p>The production feed remains empty until an approved database story is published.</p>
              </div>
            ) : null}
            {stories.map((story, index) => (
              <article className="latest-page-row" key={story.slug}>
                <div className="latest-page-row__time">
                  <time>{story.published.split(" · ")[1]}</time>
                  {currentPage === 1 && index === 0 ? <span>Latest update</span> : null}
                </div>
                <div>
                  <p className="story-eyebrow">{categoryLabel(story.category)}</p>
                  <h2>
                    <Link href={`/story/${story.slug}`}>{story.headline}</Link>
                  </h2>
                  <p>{story.dek}</p>
                  <div className="story-meta">
                    <StatusLabel status={story.status} compact />
                    <EvidenceMark story={story} />
                    <span>{story.readTime} min read</span>
                  </div>
                </div>
                <img
                  src={story.image}
                  alt=""
                  width="240"
                  height="160"
                  loading="lazy"
                  aria-hidden="true"
                />
              </article>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav className="latest-page__pager" aria-label="Archive pages">
              {currentPage > 1 ? (
                <Link href={pagePath(currentPage - 1)} rel="prev">
                  Newer
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
              <span>
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link href={pagePath(currentPage + 1)} rel="next">
                  Older
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
            </nav>
          ) : null}
        </section>
        {/* Desktop only - a second column of the same handful of stories on a
            375px screen is scrolling to skip scrolling. */}
        <aside className="latest-page__sidebar" aria-label="Top stories and newsletter">
          {topStories.length > 0 ? (
            <div className="latest-page__sidebar-block">
              <h2>Top stories</h2>
              <ol>
                {topStories.map((story) => (
                  <li key={story.slug}>
                    <Link href={`/story/${story.slug}`}>{story.headline}</Link>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="latest-page__sidebar-block">
            <h2>The Brief</h2>
            <NewsletterForm compact />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

export async function TrendingPage() {
  const { mode, trends } = await getPublicContentSnapshot();
  // Trend intelligence - what is rising before Northline has written about it
  // - is a newsroom tool, not a reader-facing product. A public page that
  // named a term and then said "not covered by Northline yet" published the
  // gap in coverage as if it were the story. Only subjects the reporting has
  // actually caught up to appear here at all.
  const covered = trends.filter((trend) => trend.storySlug);
  return (
    <PageShell>
      <PageIntro
        eyebrow="TRENDING"
        title="What people are following — and why"
        description="Interest is a signal, not a news judgment. Each trend below includes the event behind the attention."
        aside={mode === "DEMO_FIXTURES" ? <DemoDataNote /> : undefined}
      />
      <section className="shell trending-page section-space" aria-label="US trend radar">
        {covered.length === 0 ? (
          <div className="public-empty-state">
            <h2>Nothing trending we have covered yet</h2>
            <p>
              This page lists subjects rising in public attention that Northline
              has published reporting on. When our coverage catches up with what
              people are searching for, it appears here.
            </p>
          </div>
        ) : null}
        {covered.slice(0, 12).map((trend) => (
          <Link
            className="trending-page-row"
            href={`/story/${trend.storySlug}`}
            key={trend.term}
          >
            <span className="trend-state">{trendLabel(trend.velocity)}</span>
            <div>
              <p className="story-eyebrow">{categoryLabel(trend.category)}</p>
              <h2>{trendDisplayTerm(trend.term)}</h2>
              <p>Read our coverage</p>
            </div>
            <ArrowRight aria-hidden="true" />
          </Link>
        ))}
        <aside className="trending-method">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <h2>Why these appear</h2>
            <p>
              The internal newsroom weighs demand, importance, source quality,
              original value, risk, and duplication. Readers see the plain
              result—not the internal score.
            </p>
          </div>
          <Link href="/editorial-standards">Read the methodology</Link>
        </aside>
      </section>
    </PageShell>
  );
}

export async function LiveIndexPage() {
  const { liveUpdates, mode } = await getPublicContentSnapshot();
  return (
    <PageShell>
      <PageIntro
        eyebrow="LIVE DESK"
        title="Developing coverage"
        description="Timestamped updates with verification context on every entry."
        aside={
          mode === "DEMO_FIXTURES" ? (
            <span className="live-badge">
              <Radio aria-hidden="true" /> Demo coverage
            </span>
          ) : undefined
        }
      />
      <section className="shell live-index section-space">
        {liveUpdates.length === 0 ? (
          <div className="public-empty-state">
            <h2>No live coverage is active</h2>
            <p>Developing coverage will appear here after an editor opens and verifies a live story.</p>
          </div>
        ) : null}
        {liveUpdates.map((update, index) => (
          <article key={update.time}>
            <div>
              <StatusLabel status={index === 0 ? "Live" : "Developing"} />
              <time>{update.time}</time>
            </div>
            <h2>
              <Link href={`/live/${update.story.slug}`}>{update.title}</Link>
            </h2>
            <p>{update.detail}</p>
            <span>
              <ShieldCheck aria-hidden="true" /> Source record linked
            </span>
          </article>
        ))}
      </section>
    </PageShell>
  );
}

export async function LiveBlogPage({ slug }: { slug: string }) {
  const story = await getPublishedStory(slug);
  if (!story) notFound();
  const entries = story.timeline.map((entry) => ({
    time: entry.time,
    title: entry.title,
    body: entry.detail,
    state:
      entry.status === "confirmed"
        ? "Verified"
        : entry.status === "context"
          ? "Context"
          : "Watching",
  }));

  return (
    <PageShell>
      <StoryStructuredData story={story} live />
      <article className="live-blog shell">
        <header className="live-blog__header">
          <span className="live-badge">
            <Radio aria-hidden="true" /> {story.isDemo ? "LIVE DEMO" : "LIVE"}
          </span>
          <p className="story-eyebrow">{categoryLabel(story.category)}</p>
          <h1>{story.headline}</h1>
          <p>{story.dek}</p>
          <div className="story-meta">
            <span>{story.isDemo ? "Demo Live Desk" : "Live Desk"}</span>
            <span>Updated {story.updated}</span>
          </div>
        </header>
        <div className="live-blog__layout">
          <div className="live-blog__feed">
            <p className="live-blog__active">
              <strong>Coverage is active.</strong> New updates appear here only
              after verification.
            </p>
            {entries.map((entry) => (
              <section className="live-entry" key={entry.time}>
                <div>
                  <time>{entry.time}</time>
                  <span>{entry.state}</span>
                </div>
                <div>
                  <h2>{entry.title}</h2>
                  <p>{entry.body}</p>
                  <span>
                    <FileCheck2 aria-hidden="true" /> {story.sources[0]?.name ?? "Northline Live Desk"}
                  </span>
                </div>
              </section>
            ))}
          </div>
          <aside className="live-blog__aside">
            <section>
              <h2>What we know</h2>
              <ul>
                {story.keyFacts.slice(0, 3).map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </section>
            <section>
              <CircleHelp aria-hidden="true" />
              <h2>Still unclear</h2>
              <p>{story.uncertainties[0] ?? "No material uncertainty recorded."}</p>
            </section>
          </aside>
        </div>
      </article>
    </PageShell>
  );
}

export async function TopicPage({ slug }: { slug: string }) {
  const { stories } = await getPublicContentSnapshot();
  // The requested slug is normalised the same way the links are generated, so
  // an underscore form such as "us_news" resolves to the same topic as
  // "us-news" instead of returning a 404.
  const requested = toPublicSlug(slug);
  const matching = stories.filter(
    (story) =>
      toPublicSlug(story.category) === requested ||
      story.topics.some((topic) => toPublicSlug(topic) === requested),
  );
  if (!matching.length) notFound();
  const title = matching[0].topics.find(
    (topic) => toPublicSlug(topic) === requested,
  ) ??
    categoryTopic(matching[0].category).name;

  return (
    <PageShell>
      <PageIntro
        eyebrow="TOPIC"
        title={title}
        description={`Verified coverage and explainers connected to ${title}.`}
        aside={<LocalFollowButton kind="topic" label={title} />}
      />
      <section className="shell topic-page section-space">
        <StoryCard story={matching[0]} variant="lead" titleLevel={2} />
        {matching.length > 1 ? (
          <div className="topic-page__grid">
            {matching.slice(1).map((story) => (
              <StoryCard key={story.slug} story={story} titleLevel={2} />
            ))}
          </div>
        ) : (
          <p className="topic-page__quiet">
            This dossier currently contains one story. Follow the topic to
            keep it in your local watchlist.
          </p>
        )}
      </section>
    </PageShell>
  );
}

export async function SearchPage({ query = "" }: { query?: string }) {
  const { stories } = await getPublicContentSnapshot();
  // Real subjects from what is actually published, not a static example that
  // drifts from whatever the site currently covers.
  const suggestedSubjects = distinctSubjects(stories.flatMap((story) => story.topics));
  const placeholder = suggestedSubjects.length
    ? `Try "${suggestedSubjects[0]}" or a person, team, or company`
    : "Try a topic, person, or company";
  const normalized = query.trim().toLowerCase();
  const results = normalized
    ? stories.filter((story) =>
        [story.headline, story.dek, story.category, ...story.topics]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
    : stories.slice(0, 4);

  return (
    <PageShell>
      <section className="search-page shell">
        <p className="story-eyebrow">SEARCH</p>
        <h1>{query ? `Results for “${query}”` : "Find the story behind the signal"}</h1>
        <form action="/search" role="search">
          <label htmlFor="search-page-query">Search stories, topics, and sources</label>
          <div>
            <Search aria-hidden="true" />
            <input
              id="search-page-query"
              type="search"
              name="q"
              defaultValue={query}
              placeholder={placeholder}
            />
            <button type="submit">Search</button>
          </div>
        </form>
        <div className="search-results">
          <p>
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          {results.length ? (
            results.map((story) => (
              <StoryCard
                key={story.slug}
                story={story}
                variant="horizontal"
                titleLevel={2}
              />
            ))
          ) : (
            <div className="empty-state">
              <Search aria-hidden="true" />
              <h2>No exact match</h2>
              <p>Try a broader topic or browse the latest published coverage.</p>
              <Link href="/trending">Explore trending topics</Link>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
