/**
 * Composes a newsletter issue from published coverage.
 *
 * The site advertised "weekdays at 7 a.m. ET" while nothing was scheduled to
 * send anything: no job, no cron entry, no delivery log. A reader who signed up
 * would have waited forever. The promise has been withdrawn from the site, and
 * this is the machinery that has to exist before it can be made again.
 *
 * Composition is deliberately pure. Deciding what goes in an issue is the part
 * that can quietly go wrong - sending an article twice, sending an empty issue,
 * sending something that was retracted - so it is testable without a database
 * or a provider.
 */

export type IssueCandidate = {
  articleId: string;
  slug: string;
  headline: string;
  dek: string;
  publishedAtIso: string | null;
  category: string;
  /** True when the article is still publicly visible. */
  live: boolean;
};

export type ComposedIssue = {
  items: IssueCandidate[];
  /** Article ids included, for the send record that prevents repeats. */
  includedIds: string[];
  subject: string;
};

export type CompositionRefusal = {
  reason:
    | "no_new_coverage"
    | "below_minimum"
    | "already_sent_today";
  detail: string;
};

export type CompositionResult =
  | { ok: true; issue: ComposedIssue }
  | { ok: false; refusal: CompositionRefusal };

/**
 * An issue with one story in it is not worth a reader's inbox, and sending one
 * teaches people to unsubscribe.
 */
export const MINIMUM_ITEMS_PER_ISSUE = 3;
export const MAXIMUM_ITEMS_PER_ISSUE = 5;

export function composeIssue(input: {
  candidates: readonly IssueCandidate[];
  /** Article ids already sent in a previous issue. */
  alreadySent: ReadonlySet<string>;
  /** Whether an issue has already gone out for this date. */
  sentToday: boolean;
  issueDate: string;
}): CompositionResult {
  if (input.sentToday) {
    return {
      ok: false,
      refusal: {
        reason: "already_sent_today",
        detail: `An issue was already sent for ${input.issueDate}.`,
      },
    };
  }

  const fresh = input.candidates
    // A retracted or archived story must never arrive in an inbox after it has
    // been taken off the site.
    .filter((candidate) => candidate.live)
    .filter((candidate) => !input.alreadySent.has(candidate.articleId))
    .sort((left, right) => {
      const leftTime = left.publishedAtIso ? Date.parse(left.publishedAtIso) : 0;
      const rightTime = right.publishedAtIso
        ? Date.parse(right.publishedAtIso)
        : 0;
      return rightTime - leftTime;
    });

  if (fresh.length === 0) {
    return {
      ok: false,
      refusal: {
        reason: "no_new_coverage",
        detail: "Every published story has already been sent.",
      },
    };
  }

  if (fresh.length < MINIMUM_ITEMS_PER_ISSUE) {
    return {
      ok: false,
      refusal: {
        reason: "below_minimum",
        detail: `Only ${fresh.length} new stories; an issue needs ${MINIMUM_ITEMS_PER_ISSUE}.`,
      },
    };
  }

  const items = fresh.slice(0, MAXIMUM_ITEMS_PER_ISSUE);

  return {
    ok: true,
    issue: {
      items,
      includedIds: items.map((item) => item.articleId),
      // The lead headline is what a reader decides on in the inbox list.
      subject: items[0].headline.slice(0, 120),
    },
  };
}

/**
 * Plain-text and HTML bodies.
 *
 * Every link carries the campaign parameters, so newsletter traffic is
 * attributable in the same analytics the "Most read" ranking uses rather than
 * appearing as direct.
 */
export function renderIssue(
  issue: ComposedIssue,
  options: { origin: string; unsubscribeUrl: string; issueDate: string },
): { text: string; html: string } {
  const link = (slug: string) =>
    `${options.origin}/story/${slug}?utm_source=newsletter&utm_medium=email&utm_campaign=daily-brief`;

  const text = [
    "The Daily Brief",
    options.issueDate,
    "",
    ...issue.items.flatMap((item) => [
      item.headline,
      item.dek,
      link(item.slug),
      "",
    ]),
    "You are receiving this because you confirmed a subscription.",
    `Unsubscribe: ${options.unsubscribeUrl}`,
  ].join("\n");

  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const html = [
    `<h1>The Daily Brief</h1>`,
    `<p>${escape(options.issueDate)}</p>`,
    ...issue.items.map(
      (item) =>
        `<h2><a href="${escape(link(item.slug))}">${escape(item.headline)}</a></h2>` +
        `<p>${escape(item.dek)}</p>`,
    ),
    `<hr />`,
    `<p>You are receiving this because you confirmed a subscription.</p>`,
    `<p><a href="${escape(options.unsubscribeUrl)}">Unsubscribe</a></p>`,
  ].join("\n");

  return { text, html };
}
