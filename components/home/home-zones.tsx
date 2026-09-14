import Link from "next/link";
import type { Story, Trend } from "@/lib/site/types";
import { NewsletterForm } from "../newsletter-form";
import {
  categoryLabel,
  EvidenceMark,
  StatusLabel,
  StoryMedia,
  trendDisplayTerm,
} from "../story-ui";

/**
 * The front page.
 *
 * Three rules hold this together, and each one is a direct answer to why the
 * earlier version read as clutter:
 *
 *  1. A story appears once. Six zones drawing from the same pool printed the
 *     same six headlines four times over.
 *  2. A label has to tell the reader something the page does not already show.
 *     "IN ORDER" above a list, or "Interest is rising across configured source
 *     signals" repeated under every trend, is furniture.
 *  3. The page ends when the news does. Nothing is padded to fill a layout.
 */

export function HomeLead({
  lead,
  secondary,
}: {
  lead: Story;
  secondary: Story[];
}) {
  return (
    <section className="front" aria-labelledby="front-title">
      <h2 className="visually-hidden" id="front-title">
        Top stories
      </h2>

      <article className="front__lead">
        <Link
          className="front__media"
          href={`/story/${lead.slug}`}
          aria-label={`Read: ${lead.headline}`}
          tabIndex={-1}
        >
          <StoryMedia story={lead} priority ratio="cinema" credit="marker" transition />
        </Link>
        <div className="front__text">
          <p className="kicker">
            <span>{categoryLabel(lead.category)}</span>
            <StatusLabel status={lead.status} compact />
          </p>
          <h3>
            <Link href={`/story/${lead.slug}`}>{lead.headline}</Link>
          </h3>
          <p className="dek">{lead.dek}</p>
          <p className="byline">
            <EvidenceMark story={lead} />
            <span>
              {lead.author} · {lead.readTime} min read
            </span>
          </p>
        </div>
      </article>

      {secondary.length > 0 ? (
        <div className="front__secondary">
          {secondary.map((story) => (
            <article className="front__card" key={story.slug}>
              <Link
                className="front__media"
                href={`/story/${story.slug}`}
                aria-label={`Read: ${story.headline}`}
                tabIndex={-1}
              >
                <StoryMedia story={story} ratio="wide" credit="marker" />
              </Link>
              <div className="front__text">
                <p className="kicker">
                  <span>{categoryLabel(story.category)}</span>
                </p>
                <h3>
                  <Link href={`/story/${story.slug}`}>{story.headline}</Link>
                </h3>
                <p className="dek">{story.dek}</p>
                <p className="byline">
                  <EvidenceMark story={story} />
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Everything the front page has not already shown, newest first. */
export function HomeRiver({ stories }: { stories: Story[] }) {
  return (
    <section className="river" aria-labelledby="river-title">
      <div className="strip-head">
        <h2 id="river-title">Latest</h2>
        <Link href="/latest">View all</Link>
      </div>
      <ol className="river__list">
        {stories.map((story) => (
          <li key={story.slug}>
            <p className="kicker">
              <span>{categoryLabel(story.category)}</span>
            </p>
            <h3>
              <Link href={`/story/${story.slug}`}>{story.headline}</Link>
            </h3>
            <p className="dek">{story.dek}</p>
            <p className="byline">
              <EvidenceMark story={story} />
              <span>{story.readTime} min read</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * One section, one shelf: a lead card and up to two smaller ones. Content
 * decides whether this renders at all - `HomePage` only calls it once a
 * section has enough of its own stories left to fill the shelf, so Weather
 * on a day with one story never prints an empty block to satisfy a template.
 */
export function HomeSection({
  label,
  href,
  stories,
}: {
  label: string;
  href: string;
  stories: Story[];
}) {
  const [lead, ...cards] = stories;
  if (!lead) return null;
  return (
    <section className="home-section" aria-labelledby={`home-section-${href}`}>
      <div className="strip-head">
        <h2 id={`home-section-${href}`}>{label}</h2>
        <Link href={href}>View all</Link>
      </div>
      <div className="home-section__grid">
        <article className="home-section__lead">
          <Link
            className="front__media"
            href={`/story/${lead.slug}`}
            aria-label={`Read: ${lead.headline}`}
            tabIndex={-1}
          >
            <StoryMedia story={lead} ratio="wide" credit="marker" />
          </Link>
          <h3>
            <Link href={`/story/${lead.slug}`}>{lead.headline}</Link>
          </h3>
          <p className="dek">{lead.dek}</p>
          <p className="byline">
            <EvidenceMark story={lead} />
          </p>
        </article>
        {cards.slice(0, 2).map((story) => (
          <article className="home-section__card" key={story.slug}>
            <h3>
              <Link href={`/story/${story.slug}`}>{story.headline}</Link>
            </h3>
            <p className="byline">
              <EvidenceMark story={story} />
              <span>{story.readTime} min read</span>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Trends without the boilerplate sentence. A term and its subject area is all
 * the data actually supports; the old explanatory line said the same thing
 * under every entry and told the reader nothing.
 */
export function HomeTrending({ trends }: { trends: Trend[] }) {
  const visible = trends.slice(0, 6);
  if (visible.length === 0) return null;
  return (
    <section className="trend-strip" aria-labelledby="trend-title">
      <div className="strip-head">
        <h2 id="trend-title">Trending</h2>
        <Link href="/trending">See all</Link>
      </div>
      <ul className="trend-strip__list">
        {visible.map((trend) => (
          <li key={trend.term}>
            {trend.storySlug ? (
              <Link href={`/story/${trend.storySlug}`}>
                {trendDisplayTerm(trend.term)}
              </Link>
            ) : (
              <span>{trendDisplayTerm(trend.term)}</span>
            )}
            <em>{categoryLabel(trend.category)}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NewsletterInvite() {
  return (
    <section className="invite" aria-labelledby="invite-title">
      <div>
        <h2 id="invite-title">The Daily Brief</h2>
        {/* No schedule is promised until a worker exists to keep it. */}
        <p>
          Five stories that matter, in your inbox. Sign up now and you will get
          the first issue.
        </p>
      </div>
      <NewsletterForm />
    </section>
  );
}

export function RestrainedAdPlacement() {
  if (
    process.env.FEATURE_DIRECT_ADS !== "true" ||
    process.env.AD_GLOBAL_KILL !== "false"
  ) {
    return null;
  }
  return (
    <aside
      className="home-ad-placement shell"
      aria-label="Advertisement"
      data-placement="HOME_INLINE_NATIVE"
    >
      <span>Advertisement</span>
      <div aria-live="polite" />
    </aside>
  );
}

export function HomeEmptyState() {
  return (
    <main className="home-empty shell" id="main-content">
      <h1>No published stories yet.</h1>
      <p>
        Drafts and unapproved work never reach a public page. Published coverage
        appears here once it clears review.
      </p>
      <Link href="/newsletter">Join the Daily Brief</Link>
    </main>
  );
}
