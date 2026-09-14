/* eslint-disable @next/next/no-img-element -- editorial media URLs are runtime-configured and rights-reviewed */
import {
  ArrowRight,
  Clock3,
  FileText,
  Radio,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { Story, TimelineItem } from "@/lib/site/types";

export function StatusLabel({
  status,
  compact = false,
}: {
  status: Story["status"];
  compact?: boolean;
}) {
  return (
    <span
      className={`status-label status-label--${status.toLowerCase()}${
        compact ? " status-label--compact" : ""
      }`}
    >
      {status === "Live" ? (
        <Radio size={12} aria-hidden="true" />
      ) : (
        <span className="status-label__dot" aria-hidden="true" />
      )}
      {status}
    </span>
  );
}

export function StoryMedia({
  story,
  priority = false,
  ratio = "wide",
  credit = "full",
  transition = false,
}: {
  story: Story;
  priority?: boolean;
  ratio?: "wide" | "square" | "cinema";
  /**
   * Cards carry a short marker; the article page carries the full credit and
   * licence. Repeating a full disclosure sentence on every thumbnail shouted
   * over the headlines without telling the reader anything more.
   */
  credit?: "full" | "marker";
  /**
   * Names this image so it carries across a navigation instead of the reader
   * cutting to an unrelated screen. The name has to be identical on the card
   * and on the article hero, and unique within a page - a page listing the same
   * story twice would name it twice, and the browser skips the transition
   * rather than guessing, which is the correct failure.
   */
  transition?: boolean;
}) {
  // The house graphic bakes the headline into the picture, so cropping it cuts
  // the words off. Generated illustrations are rendered at 16:9 and fill the
  // frame like a photograph does.
  const composed = story.image.startsWith("/story-image/");
  return (
    <figure
      className={`story-media story-media--${ratio} story-media--${story.accent}${
        composed ? " story-media--composed" : ""
      }`}
    >
      <img
        src={story.image}
        alt={story.imageAlt}
        width="1600"
        height={ratio === "square" ? "1600" : "900"}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        style={
          transition
            ? ({
                viewTransitionName: `story-${story.slug}`,
              } as React.CSSProperties)
            : undefined
        }
        sizes={
          ratio === "square"
            ? "(max-width: 640px) 100vw, 320px"
            : "(max-width: 900px) 100vw, 800px"
        }
      />
      {credit === "marker" ? (
        <figcaption className="story-media__marker">
          {story.imageCredit?.startsWith("AI-generated")
            ? "Illustration"
            : "Photo"}
        </figcaption>
      ) : (
      <figcaption>
        <span>Image</span>{" "}
        {story.imageSourceUrl ? (
          <a href={story.imageSourceUrl} rel="noopener noreferrer nofollow">
            {story.imageCredit}
          </a>
        ) : (
          story.imageCredit
        )}
        {story.imageLicenseUrl && story.imageLicense ? (
          <>
            {" · "}
            <a href={story.imageLicenseUrl} rel="license noopener noreferrer">
              {story.imageLicense}
            </a>
          </>
        ) : null}
      </figcaption>
      )}
    </figure>
  );
}

/**
 * The citation spine, in card form — Northline's one idea made visible before
 * the reader clicks. Every tick is a real source on the story, its height and
 * weight set by the source's tier; a primary record is drawn in the verified
 * colour. A story with no sources shows nothing, which is the honest failure:
 * a thin story reads as thin rather than borrowing the look of a sourced one.
 */
export function EvidenceMark({ story, max = 9 }: { story: Story; max?: number }) {
  const sources = story.sources ?? [];
  if (sources.length === 0) return null;
  const primary = sources.filter((source) => source.kind === "Primary").length;
  const shown = sources.slice(0, max);
  const label = `${sources.length} source${sources.length === 1 ? "" : "s"}`;
  return (
    <span
      className="evidence"
      aria-label={primary ? `${label}, ${primary} primary` : label}
    >
      <span className="evidence__ticks" aria-hidden="true">
        {shown.map((source, index) => (
          <i
            key={index}
            data-tier={source.tier}
            data-primary={source.kind === "Primary" ? "" : undefined}
          />
        ))}
      </span>
      <span className="evidence__count">{label}</span>
    </span>
  );
}

export function StoryCard({
  story,
  variant = "standard",
  rank,
  titleLevel = 2,
}: {
  story: Story;
  variant?: "standard" | "compact" | "horizontal" | "lead";
  rank?: number;
  titleLevel?: 1 | 2 | 3;
}) {
  const Heading = `h${titleLevel}` as "h1" | "h2" | "h3";

  if (variant === "compact") {
    return (
      <article className="compact-story">
        {rank ? (
          <span className="compact-story__rank" aria-hidden="true">
            {String(rank).padStart(2, "0")}
          </span>
        ) : null}
        <div>
          <p className="story-eyebrow">{categoryLabel(story.category)}</p>
          <Heading>
            <Link href={`/story/${story.slug}`}>{story.headline}</Link>
          </Heading>
          <div className="story-meta">
            <StatusLabel status={story.status} compact />
            <EvidenceMark story={story} max={5} />
            <span>{story.readTime} min read</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "horizontal") {
    return (
      <article className="story-card story-card--horizontal">
        <Link
          className="story-card__media-link"
          href={`/story/${story.slug}`}
          aria-label={`Read: ${story.headline}`}
        >
          <StoryMedia story={story} ratio="wide" credit="marker" />
        </Link>
        <div className="story-card__content">
          <p className="story-eyebrow">{categoryLabel(story.category)}</p>
          <Heading>
            <Link href={`/story/${story.slug}`}>{story.headline}</Link>
          </Heading>
          <p className="story-card__dek">{story.dek}</p>
          <div className="story-meta">
            <StatusLabel status={story.status} compact />
            <EvidenceMark story={story} />
            <span>{story.readTime} min read</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "lead") {
    return (
      <article className="lead-story">
        <Link
          className="lead-story__media"
          href={`/story/${story.slug}`}
          aria-label={`Read: ${story.headline}`}
        >
          <StoryMedia story={story} priority ratio="cinema" credit="marker" />
        </Link>
        <div className="lead-story__content">
          <div className="lead-story__kicker">
            <p className="story-eyebrow">{categoryLabel(story.category)}</p>
            <StatusLabel status={story.status} />
          </div>
          <Heading>
            <Link href={`/story/${story.slug}`}>{story.headline}</Link>
          </Heading>
          <p className="lead-story__dek">{story.dek}</p>
          <div className="story-meta story-meta--roomy">
            <EvidenceMark story={story} />
            <span>By {story.author}</span>
            <span>{story.updated}</span>
            <span>{story.readTime} min read</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="story-card">
      <Link
        className="story-card__media-link"
        href={`/story/${story.slug}`}
        aria-label={`Read: ${story.headline}`}
      >
        <StoryMedia story={story} credit="marker" />
      </Link>
      <div className="story-card__content">
        <p className="story-eyebrow">{categoryLabel(story.category)}</p>
        <Heading>
          <Link href={`/story/${story.slug}`}>{story.headline}</Link>
        </Heading>
        <p className="story-card__dek">{story.dek}</p>
        <div className="story-meta">
          <StatusLabel status={story.status} compact />
          <EvidenceMark story={story} />
          <span>{story.readTime} min read</span>
        </div>
      </div>
    </article>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  href,
  action = "View all",
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {href ? (
        <Link href={href}>
          {action} <ArrowRight aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Trend terms arrive as raw search queries - lowercase, sometimes with an
 * acronym buried in them ("st louis weather", "nfl draft"). Printing them
 * verbatim made the page read like a log file rather than a news index.
 */
const TREND_ACRONYMS = new Set([
  "us", "usa", "uk", "eu", "un", "nfl", "nba", "mlb", "nhl", "ncaa", "ufc",
  "f1", "nasa", "fbi", "cia", "irs", "fda", "cdc", "ai", "gdp", "ceo", "tv",
  "us open", "atp", "wta", "pga", "mvp", "espn", "nyc", "la", "dc",
]);
const TREND_MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or",
  "the", "to", "vs", "with",
]);

export function trendDisplayTerm(value: string): string {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (TREND_ACRONYMS.has(lower)) return lower.toUpperCase();
      // Minor words stay lowercase unless they open the phrase.
      if (index > 0 && TREND_MINOR_WORDS.has(lower)) return lower;
      // Preserve an already-capitalised or mixed-case term as the source wrote it.
      if (/[A-Z]/u.test(word.slice(1))) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Categories are stored as enum tokens. Printing US_NEWS to a reader is the
 * database leaking onto the page.
 */
const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  US_NEWS: "U.S.",
  WORLD: "World",
  POLITICS: "Politics",
  BUSINESS: "Business",
  FINANCE: "Finance",
  TECHNOLOGY: "Technology",
  SCIENCE: "Science",
  HEALTH: "Health",
  SPORTS: "Sports",
  ENTERTAINMENT: "Entertainment",
  GAMING: "Gaming",
  WEATHER: "Weather",
  INTERNET_TRENDS: "Internet",
  SOURCE_COMPARISON: "Analysis",
};

export function categoryLabel(value: string): string {
  const key = value.trim().toUpperCase();
  return (
    CATEGORY_LABELS[key] ??
    key
      .split(/[_\s]+/u)
      .filter(Boolean)
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ")
  );
}

export function trendLabel(value: number): "Rising" | "Surging" | "Developing" {
  if (value >= 88) return "Surging";
  if (value >= 76) return "Rising";
  return "Developing";
}

export function TrendMeter({
  value,
  label = "Reader interest",
}: {
  value: number;
  label?: string;
}) {
  const state = trendLabel(value);
  const boundedValue = Math.min(100, Math.max(18, value));
  return (
    <div className="trend-meter" aria-label={`${label}: ${state}`}>
      <div>
        <span>{label}</span>
        <strong>{state}</strong>
      </div>
      <progress
        className="trend-meter__track"
        max={100}
        value={boundedValue}
        aria-label={label}
      />
    </div>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={`${item.time}-${item.title}`} data-status={item.status}>
          <div className="timeline__rail" aria-hidden="true">
            <span />
          </div>
          <div>
            <time>{item.time}</time>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SourceStack({ story }: { story: Story }) {
  return (
    <div className="source-stack">
      <div className="source-stack__intro">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>{story.sources.length} sources in this dossier</strong>
          <span>
            {story.sources.filter((source) => source.kind === "Primary").length}{" "}
            primary records
          </span>
        </div>
      </div>
      {story.sources.map((source) => (
        <article key={source.id}>
          <span className={`source-tier source-tier--${source.tier}`}>
            T{source.tier}
          </span>
          <div>
            <h3>
              <Link href={source.locator}>{source.name}</Link>
            </h3>
            <p>{source.note}</p>
          </div>
          <span className="source-kind">{source.kind}</span>
        </article>
      ))}
    </div>
  );
}

export function FactStatus({ score }: { score: number }) {
  const confidence =
    score >= 90 ? "Core claims verified" : "Verification in progress";
  return (
    <div className="fact-status">
      <ShieldCheck aria-hidden="true" />
      <div>
        <span>Verification status</span>
        <strong>{confidence}</strong>
      </div>
    </div>
  );
}

export function FormatLabel({ story }: { story: Story }) {
  return (
    <span className="format-label">
      {story.format === "Live Blog" ? (
        <Radio aria-hidden="true" />
      ) : story.format === "Deep Explainer" ? (
        <FileText aria-hidden="true" />
      ) : (
        <Clock3 aria-hidden="true" />
      )}
      {story.format}
    </span>
  );
}
