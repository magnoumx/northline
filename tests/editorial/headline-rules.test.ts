import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  articleDraftSchema,
  automatedResearchDraftSchema,
} from "../../lib/ai/editorial-schemas";

const gatewaySource = readFileSync("lib/ai/editorial-gateway.ts", "utf8");

/** The exact headline this newsroom published before the ceiling was fixed. */
const PUBLISHED_TOO_LONG =
  "Ian Happ Anchors the Chicago Cubs Core: Contract Stability, Defensive Excellence, and Middle-of-the-Order Impact";

const draftBody = {
  subheadline:
    "A short, factual deck that explains what the story establishes for a reader.",
  sections: [
    {
      heading: "What happened",
      paragraphs: [
        "A paragraph of reporting long enough to satisfy the section schema minimum.",
      ],
      claimIdsUsed: [],
    },
  ],
  unknownsDisclosed: [],
};

describe("headline length ceiling", () => {
  it("rejects the 112-character headline the newsroom actually published", () => {
    expect(PUBLISHED_TOO_LONG.length).toBeGreaterThan(100);
    const result = articleDraftSchema.safeParse({
      ...draftBody,
      headline: PUBLISHED_TOO_LONG,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a headline that fits inside a Google search result", () => {
    const headline = "Ian Happ Signs Cubs Extension Through 2026";
    expect(headline.length).toBeLessThanOrEqual(65);
    const result = articleDraftSchema.safeParse({ ...draftBody, headline });
    expect(result.success).toBe(true);
  });

  it("applies the same ceiling to the autonomous research draft that feeds publication", () => {
    // The published headline comes from research.data.article.headline, so a
    // ceiling on articleDraftSchema alone would leave the real path uncapped.
    const shape = automatedResearchDraftSchema.shape.article.shape.headline;
    expect(shape.safeParse(PUBLISHED_TOO_LONG).success).toBe(false);
    expect(
      shape.safeParse("Cubs Extend Ian Happ Through the 2026 Season").success,
    ).toBe(true);
  });
});

describe("headline style rules", () => {
  it("bans the templated openings that produced near-identical headlines", () => {
    for (const banned of ["Inside", "Understanding", "Beyond", "Decoding"]) {
      expect(gatewaySource).toContain(banned);
    }
    expect(gatewaySource).toContain("50-65 characters");
  });

  it("attaches the rules to every prompt that emits a headline", () => {
    for (const promptId of [
      "article-plan",
      "article-draft",
      "automated-research-draft",
      "headline-candidates",
    ]) {
      expect(gatewaySource).toContain(`"${promptId}"`);
    }
    expect(gatewaySource).toMatch(/headlineProducers\.has\(promptId\)/);
  });

  it("does not hand headline styling to prompts with no headline field", () => {
    // fact-review returns findings, not prose - styling instructions there are
    // noise that competes with the actual task.
    const producers = /const headlineProducers = new Set\(\[([\s\S]*?)\]\)/.exec(
      gatewaySource,
    );
    expect(producers).not.toBeNull();
    expect(producers?.[1]).not.toContain("fact-review");
    expect(producers?.[1]).not.toContain("evidence-comparison");
  });
});
