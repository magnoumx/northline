import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync("components/newsroom/article-editor.tsx", "utf8");
const service = readFileSync("lib/editorial/article-write-service.ts", "utf8");

/**
 * A stale article reached production because the queue offered an Approve
 * button and said nothing else. The gate had already refused it - score 55,
 * reasons ["fact_review_blocking", "event_older_than_publication"] - but the
 * audit log shows a human approving it four hours later with no way to see
 * that from the screen they were looking at.
 *
 * These are source-shape assertions rather than render assertions because the
 * suite runs in a node environment with no DOM. They still fail if the reasons
 * stop reaching the screen, which is the regression that matters.
 */
describe("approval queue surfaces the gate's refusal", () => {
  it("carries the reasons and score out of the database", () => {
    expect(service).toContain("v.quality_explanation_json");
    expect(service).toContain("v.quality_score");
    expect(service).toMatch(/qualityReasons:\s*parseQualityReasons/u);
  });

  it("renders the reasons next to the Approve control", () => {
    // The button and the reasons live in one element, so neither can be
    // removed without the other going with it.
    const approve = editor.slice(
      editor.indexOf('<span className="article-row-approve">'),
      editor.indexOf('runWorkflowAction(article, "approve")'),
    );
    expect(approve).toContain("article.qualityReasons");
    expect(approve).toContain("heldReasonLabel");
    expect(approve).toContain("article.qualityScore");
  });

  it("translates the gate's codes into something a person can act on", () => {
    // Verbatim codes are what the reviewer already could not act on.
    expect(editor).toMatch(
      /event_older_than_publication:\s*"the event is far older than today"/u,
    );
    expect(editor).toMatch(/fact_review_blocking:\s*"/u);
  });
});

/**
 * Every article in the review queue reports `fact_review_blocking`, and every
 * one of them records `factReviewProvider: "deterministic"` - the fallback that
 * only appears when the review call threw. The reviewer never ran on any of
 * them. The gate was reporting an editorial objection that never happened.
 */
describe("a review that never ran is not reported as a review that objected", () => {
  const pipeline = readFileSync("lib/editorial/autonomous-newsroom.ts", "utf8");

  it("tracks whether the reviewer actually returned", () => {
    // The catch only logged, leaving the initial blocking=true in place.
    expect(pipeline).toMatch(/let reviewUnavailable = true;/u);
    expect(pipeline).toMatch(/reviewUnavailable = false;/u);
  });

  it("reports the distinct reason without changing what blocks", () => {
    expect(pipeline).toMatch(
      /reviewUnavailable \? "fact_review_unavailable" : "fact_review_blocking"/u,
    );
    // Both still block. Only the reason an operator reads changes.
    expect(pipeline).toContain("if (factReviewBlocks) {");
  });

  it("is spelled out on both surfaces an operator approves from", () => {
    expect(editor).toContain("fact_review_unavailable");
    const workspace = readFileSync(
      "components/newsroom/live-review-workspace.tsx",
      "utf8",
    );
    expect(workspace).toContain("fact_review_unavailable");
  });
});
