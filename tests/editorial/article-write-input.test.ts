import { describe, expect, it } from "vitest";
import {
  articleVersionInputSchema,
  correctionInputSchema,
  createArticleInputSchema,
} from "../../lib/editorial/article-input";
import {
  publishArticleCorrection,
} from "../../lib/editorial/article-write-service";

function validVersion() {
  return {
    headline: "Federal agency publishes a verified technology update",
    subheadline:
      "The announcement includes dates, scope, and primary documentation.",
    body: [
      {
        heading: "What happened",
        paragraphs: ["The agency published a documented update on Friday."],
      },
    ],
    keyTakeaways: ["The primary release supplies the effective date."],
    seo: {
      summary:
        "A concise reader summary grounded in the primary announcement.",
      uncertainties: [],
      demandEstimate: "unknown" as const,
    },
    structuredData: {},
    changeSummary: "Create the first evidence-linked editorial version.",
    sources: [
      {
        sourceId: "source_primary_1",
        relationship: "PRIMARY" as const,
        summary: "The official announcement and implementation details.",
      },
      {
        sourceId: "source_independent_1",
        relationship: "INDEPENDENT" as const,
        summary: "Independent context about the scope of the announcement.",
      },
    ],
    claims: [
      {
        claimText: "The update takes effect on the date in the release.",
        articleSection: "What happened",
        category: "date",
        importance: "central" as const,
        primaryEvidenceAvailable: true,
        verificationStatus: "VERIFIED" as const,
        riskLevel: "LOW" as const,
        evidence: [
          {
            sourceId: "source_primary_1",
            relationship: "SUPPORTS" as const,
            sourceLocator: "release paragraph 2",
            observedAt: "2026-07-24T12:00:00.000Z",
          },
        ],
      },
    ],
  };
}

describe("editorial write DTOs", () => {
  it("accepts structured text, linked evidence, and explicitly unknown demand", () => {
    expect(
      createArticleInputSchema.safeParse({
        slug: "verified-technology-update",
        category: "TECHNOLOGY",
        format: "STANDARD_NEWS",
        sensitive: false,
        version: validVersion(),
      }).success,
    ).toBe(true);
  });

  it("rejects evidence that is not linked to the article version", () => {
    const version = validVersion();
    version.claims[0].evidence[0].sourceId = "source_unlinked_1";
    const parsed = articleVersionInputSchema.safeParse(version);
    expect(parsed.success).toBe(false);
    expect(
      parsed.error?.issues.some((issue) =>
        issue.message.includes("source linked"),
      ),
    ).toBe(true);
  });

  it("rejects unknown top-level fields to prevent mass assignment", () => {
    const parsed = createArticleInputSchema.safeParse({
      slug: "verified-technology-update",
      category: "TECHNOLOGY",
      format: "STANDARD_NEWS",
      sensitive: false,
      state: "PUBLISHED",
      version: validVersion(),
    });
    expect(parsed.success).toBe(false);
  });

  it("fails before storage when a correction packet lacks independent evidence", async () => {
    const version = validVersion();
    version.sources = version.sources.slice(0, 1);
    const parsed = correctionInputSchema.parse({
      expectedCurrentVersionId: "version_current_1",
      publicNotice:
        "We corrected the effective date and explain the change to readers.",
      reason:
        "The primary release superseded the date used in the earlier version.",
      version,
    });
    await expect(
      publishArticleCorrection(
        "article_test_1",
        parsed,
        { userId: "publisher_test_1", type: "PUBLISHER" },
        "correction-test-key-0001",
      ),
    ).rejects.toMatchObject({
      code: "PUBLICATION_PACKET_INCOMPLETE",
    });
  });
});
