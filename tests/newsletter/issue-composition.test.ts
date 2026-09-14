import { describe, expect, it } from "vitest";
import {
  composeIssue,
  MINIMUM_ITEMS_PER_ISSUE,
  MAXIMUM_ITEMS_PER_ISSUE,
  renderIssue,
  type IssueCandidate,
} from "../../lib/newsletter/issue-composition";

const candidate = (
  id: string,
  publishedAtIso: string,
  overrides: Partial<IssueCandidate> = {},
): IssueCandidate => ({
  articleId: `article_${id}`,
  slug: id,
  headline: `Headline ${id}`,
  dek: `Deck ${id}`,
  publishedAtIso,
  category: "US_NEWS",
  live: true,
  ...overrides,
});

const six = [
  candidate("a", "2026-08-03T06:00:00Z"),
  candidate("b", "2026-08-03T05:00:00Z"),
  candidate("c", "2026-08-03T04:00:00Z"),
  candidate("d", "2026-08-03T03:00:00Z"),
  candidate("e", "2026-08-03T02:00:00Z"),
  candidate("f", "2026-08-03T01:00:00Z"),
];

const base = {
  alreadySent: new Set<string>(),
  sentToday: false,
  issueDate: "2026-08-03",
};

describe("issue composition", () => {
  it("takes the newest stories, capped", () => {
    const result = composeIssue({ ...base, candidates: six });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issue.items).toHaveLength(MAXIMUM_ITEMS_PER_ISSUE);
    expect(result.issue.items[0].slug).toBe("a");
    expect(result.issue.subject).toBe("Headline a");
  });

  it("never sends the same story twice", () => {
    const result = composeIssue({
      ...base,
      candidates: six,
      alreadySent: new Set(["article_a", "article_b"]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issue.includedIds).not.toContain("article_a");
    expect(result.issue.items[0].slug).toBe("c");
  });

  it("refuses to send an issue that is mostly empty", () => {
    // A one-story issue teaches people to unsubscribe.
    const result = composeIssue({ ...base, candidates: six.slice(0, 2) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("below_minimum");
    expect(result.refusal.detail).toContain(String(MINIMUM_ITEMS_PER_ISSUE));
  });

  it("refuses when everything has already been sent", () => {
    const result = composeIssue({
      ...base,
      candidates: six,
      alreadySent: new Set(six.map((item) => item.articleId)),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("no_new_coverage");
  });

  it("refuses a second issue on the same day", () => {
    const result = composeIssue({ ...base, candidates: six, sentToday: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe("already_sent_today");
  });

  it("never mails a story that has been taken off the site", () => {
    // A retraction must not arrive in an inbox after the page is gone.
    const withdrawn = six.map((item, index) =>
      index === 0 ? { ...item, live: false } : item,
    );
    const result = composeIssue({ ...base, candidates: withdrawn });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issue.includedIds).not.toContain("article_a");
  });
});

describe("issue rendering", () => {
  const issue = composeIssue({ ...base, candidates: six });

  it("tags every link so newsletter traffic is attributable", () => {
    if (!issue.ok) throw new Error("expected an issue");
    const { text, html } = renderIssue(issue.issue, {
      origin: "https://usnorthline.com",
      unsubscribeUrl: "https://usnorthline.com/unsubscribe?t=x",
      issueDate: "2026-08-03",
    });
    expect(text).toContain("utm_source=newsletter");
    expect(html).toContain("utm_campaign=daily-brief");
  });

  it("always carries an unsubscribe link", () => {
    if (!issue.ok) throw new Error("expected an issue");
    const { text, html } = renderIssue(issue.issue, {
      origin: "https://usnorthline.com",
      unsubscribeUrl: "https://usnorthline.com/unsubscribe?t=x",
      issueDate: "2026-08-03",
    });
    expect(text).toContain("Unsubscribe:");
    expect(html).toContain(">Unsubscribe<");
  });

  it("escapes headline text so a story cannot inject markup", () => {
    const hostile = composeIssue({
      ...base,
      candidates: [
        candidate("x", "2026-08-03T06:00:00Z", {
          headline: '<img src=x onerror="alert(1)">',
        }),
        candidate("y", "2026-08-03T05:00:00Z"),
        candidate("z", "2026-08-03T04:00:00Z"),
      ],
    });
    if (!hostile.ok) throw new Error("expected an issue");
    const { html } = renderIssue(hostile.issue, {
      origin: "https://usnorthline.com",
      unsubscribeUrl: "https://usnorthline.com/unsubscribe?t=x",
      issueDate: "2026-08-03",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});
