import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { articleVersionInputSchema } from "../../lib/editorial/article-input";

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const writeService = read("../../lib/editorial/article-write-service.ts");
const newsroom = read("../../lib/editorial/autonomous-newsroom.ts");
const readService = read("../../lib/newsroom/editorial-read-service.ts");

const baseInput = {
  headline: "A headline that is long enough to pass validation",
  subheadline: "A subheadline that is also long enough to pass validation",
  body: [{ paragraphs: ["One paragraph of body text that is long enough."] }],
  keyTakeaways: ["A takeaway that is long enough to pass validation"],
  seo: { summary: "A summary that is at least twenty characters long.", uncertainties: [] },
  changeSummary: "A change summary that is long enough to pass validation.",
  sources: [
    {
      sourceId: "source_example00000000000000000",
      relationship: "PRIMARY",
      summary: "A source summary that is long enough to pass validation.",
    },
  ],
  claims: [
    {
      claimText: "A claim that is long enough to pass validation.",
      articleSection: "Central claim",
      category: "US_NEWS",
      importance: "central",
      primaryEvidenceAvailable: true,
      verificationStatus: "VERIFIED",
      riskLevel: "LOW",
      evidence: [],
    },
  ],
};

describe("quality score is accepted by the input schema", () => {
  it("accepts a score and reasons alongside the rest of the version", () => {
    const parsed = articleVersionInputSchema.parse({
      ...baseInput,
      qualityScore: 82,
      qualityReasons: ["missing_independent_sources"],
    });
    expect(parsed.qualityScore).toBe(82);
    expect(parsed.qualityReasons).toEqual(["missing_independent_sources"]);
  });

  it("is optional, so hand-authored edits are not forced to supply it", () => {
    expect(() => articleVersionInputSchema.parse(baseInput)).not.toThrow();
  });

  it("rejects a score outside 0-100", () => {
    expect(() =>
      articleVersionInputSchema.parse({ ...baseInput, qualityScore: 101 }),
    ).toThrow();
    expect(() =>
      articleVersionInputSchema.parse({ ...baseInput, qualityScore: -1 }),
    ).toThrow();
  });
});

describe("quality score reaches the database", () => {
  it("is in every article_versions INSERT's column list", () => {
    // The column existed and was read everywhere, but no INSERT statement ever
    // named it, so the dashboard showed a permanent 0 no matter how an article
    // actually scored.
    const inserts = [...writeService.matchAll(/INSERT INTO article_versions[\s\S]*?\)/gu)];
    expect(inserts.length).toBeGreaterThanOrEqual(3);
    for (const insert of inserts) {
      expect(insert[0]).toContain("quality_score");
      expect(insert[0]).toContain("quality_explanation_json");
    }
  });

  it("binds the computed score and reasons, not a hardcoded default", () => {
    const binds = [...writeService.matchAll(/input\.qualityScore \?\? 0/gu)];
    expect(binds.length).toBeGreaterThanOrEqual(3);
  });

  it("is populated by the autonomous pipeline from the score it actually computed", () => {
    const flat = newsroom.replace(/\s+/gu, " ");
    expect(flat).toContain("qualityScore: Math.round(qualityScore),");
    expect(flat).toContain("qualityReasons: reasons,");
  });
});

describe("a held article shows the reviewer why", () => {
  it("reads the stored explanation back out", () => {
    expect(readService).toContain("quality_explanation_json AS qualityExplanationJson");
    expect(readService).toContain("qualityReasons: readQualityReasons(qualityExplanationJson)");
  });

  it("never throws on a malformed or missing explanation", () => {
    expect(readService).toContain("function readQualityReasons");
    const fn = readService.slice(readService.indexOf("function readQualityReasons"));
    expect(fn).toContain("try {");
    expect(fn).toContain("} catch {");
    expect(fn).toContain("return [];");
  });
});
