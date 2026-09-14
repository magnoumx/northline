import { describe, expect, it } from "vitest";
import {
  buildNarrationDocument,
  chunkNarrationDocument,
  normalizeNarrationText,
  type ImmutablePublishedArticleVersion,
} from "../../lib/audio";

describe("narration-safe article input", () => {
  it("uses only an immutable published article version", async () => {
    await expect(
      buildNarrationDocument(
        {
          ...article(),
          publishedAt: new Date(Number.NaN),
        },
        "FULL_ARTICLE",
        "policy-1",
      ),
    ).rejects.toThrow("immutable published article version");
  });

  it("preserves useful headings and removes non-spoken blocks and URLs", async () => {
    const document = await buildNarrationDocument(
      article(),
      "FULL_ARTICLE",
      "policy-1",
    );

    expect(document.text).toContain("What changed");
    expect(document.text).toContain("July 24, 2026");
    expect(document.text).toContain("1.5 million dollars");
    expect(document.text).toContain("12 dollars and 50 cents");
    expect(document.text).toContain("A I");
    expect(document.text).not.toContain("Advertisement");
    expect(document.text).not.toContain("Do not read this caption");
    expect(document.text).not.toContain("https://");
    expect(document.chapters.length).toBe(2);
  });

  it("builds a concise quick brief from headline, dek, and takeaways", async () => {
    const document = await buildNarrationDocument(
      article(),
      "QUICK_BRIEF",
      "policy-1",
    );

    expect(document.text).toContain("Key takeaways");
    expect(document.text).toContain("First verified fact");
    expect(document.text).not.toContain("What changed");
  });

  it("splits deterministically without exceeding provider bounds", async () => {
    const document = await buildNarrationDocument(
      {
        ...article(),
        bodyJson: JSON.stringify([
          {
            heading: "Long section",
            paragraphs: [Array.from({ length: 220 }, () => "word").join(" ")],
          },
        ]),
      },
      "FULL_ARTICLE",
      "policy-1",
    );
    const first = await chunkNarrationDocument(document, 250);
    const second = await chunkNarrationDocument(document, 250);

    expect(first.length).toBeGreaterThan(2);
    expect(first.every((chunk) => chunk.characterCount <= 250)).toBe(true);
    expect(first.map((chunk) => chunk.textHash)).toEqual(
      second.map((chunk) => chunk.textHash),
    );
  });

  it("normalizes markup and control characters", () => {
    expect(
      normalizeNarrationText(
        "<script>bad()</script><strong>Hello</strong>\u0000 &amp; welcome",
      ),
    ).toBe("Hello and welcome");
  });
});

function article(): ImmutablePublishedArticleVersion {
  return {
    articleId: "article_12345678",
    articleVersionId: "version_12345678",
    versionNumber: 3,
    publishedAt: new Date("2026-07-24T12:00:00.000Z"),
    headline: "AI funding update",
    subheadline: "Verified details from U.S. agencies",
    bodyJson: JSON.stringify([
      {
        heading: "What changed",
        paragraphs: [
          "On 2026-07-24, the agency announced $1.5 million and $12.50 in fees. Read https://example.com.",
        ],
      },
      { type: "caption", text: "Do not read this caption" },
      { type: "ad_label", text: "Advertisement" },
    ]),
    keyTakeawaysJson: JSON.stringify([
      "First verified fact",
      "Second verified fact",
    ]),
    category: "Policy",
    sensitive: false,
  };
}
