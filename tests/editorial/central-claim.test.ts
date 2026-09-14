import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pipeline = readFileSync(
  fileURLToPath(
    new URL("../../lib/editorial/autonomous-newsroom.ts", import.meta.url),
  ),
  "utf8",
);
const writeService = readFileSync(
  fileURLToPath(
    new URL("../../lib/editorial/article-write-service.ts", import.meta.url),
  ),
  "utf8",
);

describe("central claim designation", () => {
  it("records exactly one central claim, chosen by evidence", () => {
    // The defect: the extraction model marked three or more claims "central",
    // publication requires every central claim to carry primary evidence, and a
    // well-sourced article was refused because a supporting detail wore the
    // wrong label.
    expect(pipeline).toContain("const centralClaimId =");
    expect(pipeline).toContain("claimQualifies");
    expect(pipeline).toContain(
      'importance: isCentral ? ("central" as const) : ("supporting" as const)',
    );
  });

  it("only qualifies a claim that review supported and primary evidence backs", () => {
    const start = pipeline.indexOf("const claimQualifies");
    // Collapsed so the assertion survives ordinary line wrapping.
    const body = pipeline.slice(start, start + 700).replace(/\s+/gu, " ");
    expect(body).toContain('?.disposition === "supported"');
    expect(body).toContain('?.sourceKind === "PRIMARY"');
    expect(body).toContain("return supported && hasPrimary;");
  });

  it("judges the gate against the claim it will actually persist", () => {
    // Checking claims[0] while persisting a different claim is how an article
    // passed the gate and was then refused at publication.
    expect(pipeline).toContain("const persistedCentral =");
    expect(pipeline).toContain(
      "findings.find((finding) => finding.claimId === centralClaimId)",
    );
    expect(pipeline).not.toMatch(
      /if \(!central \|\| centralFinding\?\.disposition !== "supported"\)/u,
    );
  });

  it("leaves the publication contract itself untouched", () => {
    // The fix must be in how claims are labelled, never in what publication
    // demands of them.
    expect(writeService).toContain("AND (verification_status <> 'VERIFIED'");
    expect(writeService).toContain("OR primary_evidence_available <> 1)");
    expect(writeService).toContain("(packet.blockedCentral ?? 0) > 0");
    expect(writeService).toContain("packet.primaryCount < 1");
  });
});

describe("the fact-review gate checks the same claim publication will", () => {
  it("computes centralClaimId once, before the gate that reads it", () => {
    // fact_review_blocking was the largest single cause of unnecessary human
    // review - 48 of the last 60 blocked runs, ahead of every real sourcing
    // gap combined. The gate was checking the model's first "central"-labelled
    // claim, or claims[0], which is a coin flip when the model over-labels
    // several claims central: a well-sourced story was blocked because that
    // first claim was unsupported, while the claim centralClaimId would go on
    // to correctly select - fully verified, primary evidence attached - never
    // got read before the gate had already fired.
    const definitions = [...pipeline.matchAll(/const centralClaimId =/gu)];
    expect(definitions).toHaveLength(1);

    const centralClaimSupported = pipeline.indexOf("const centralClaimSupported");
    const factReviewBlocks = pipeline.indexOf("const factReviewBlocks");
    const centralClaimIdAt = definitions[0].index;
    expect(centralClaimIdAt).toBeLessThan(centralClaimSupported);
    expect(centralClaimSupported).toBeLessThan(factReviewBlocks);
  });

  it("reads centralClaimSupported from centralClaimId, not from claims[0]", () => {
    const start = pipeline.indexOf("const centralClaimSupported");
    const body = pipeline
      .slice(start, pipeline.indexOf("const maximumUnsupportedShare"))
      .replace(/\s+/gu, " ");
    expect(body).toContain(
      "findings.find((finding) => finding.claimId === centralClaimId)",
    );
    expect(body).not.toContain("claims[0]");
    expect(body).not.toContain('claim.importance === "central") ?? claims[0]');
  });
});

describe("autopublish resilience", () => {
  it("skips an article the contract refuses instead of failing the run", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const executors = readFileSync(
      fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
      "utf8",
    ).replace(/\s+/gu, " ");

    // One unpublishable story was failing the whole job, so every approved
    // story queued behind it stayed unpublished.
    expect(executors).toContain('"PUBLICATION_PACKET_INCOMPLETE",');
    const guard = executors.indexOf("PUBLICATION_PACKET_INCOMPLETE");
    const rethrow = executors.indexOf("throw error;", guard);
    const skip = executors.indexOf("continue;", guard);
    expect(skip).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(rethrow);
  });
});
