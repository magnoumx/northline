import { describe, expect, it } from "vitest";
import { describeWorkflow } from "../../lib/content/workflow-disclosure";

const autonomous = {
  author: "Northline Autonomous Desk",
  humanReviewer: null,
  approvedBy: "system:autonomous",
  draftingProvider: "google",
  factReviewProvider: "anthropic",
};

describe("workflow disclosure", () => {
  it("never claims a human reviewed an article that no human read", () => {
    // The defect: every published story displayed "Standards Desk" as its
    // reviewer and emitted a matching reviewedBy, with zero review records
    // behind it.
    const disclosure = describeWorkflow(autonomous);
    expect(disclosure.humanReviewed).toBe(false);
    expect(disclosure.statement).toContain(
      "No human review was performed before publication",
    );
    expect(disclosure.statement).not.toMatch(/desk|standards/iu);
  });

  it("treats a system actor as automation, not as an approver", () => {
    for (const actor of ["system:autonomous", "system:autopublish", "system:x"]) {
      expect(
        describeWorkflow({ ...autonomous, approvedBy: actor }).humanReviewed,
      ).toBe(false);
    }
  });

  it("names a real human reviewer when one exists", () => {
    const disclosure = describeWorkflow({
      ...autonomous,
      humanReviewer: "Omar Mohamed",
    });
    expect(disclosure.humanReviewed).toBe(true);
    expect(disclosure.statement).toContain("Omar Mohamed");
  });

  it("credits a real human approver even without a reviewer assignment", () => {
    const disclosure = describeWorkflow({
      ...autonomous,
      approvedBy: "Omar Mohamed",
    });
    expect(disclosure.humanReviewed).toBe(true);
    expect(disclosure.statement).toContain("approved for publication by Omar Mohamed");
  });

  it("claims model independence only when a second provider actually ran", () => {
    expect(describeWorkflow(autonomous).independentModelReview).toBe(true);

    // Same provider for both stages is not independence.
    expect(
      describeWorkflow({ ...autonomous, factReviewProvider: "google" })
        .independentModelReview,
    ).toBe(false);
    // A stage that never ran is not independence either.
    expect(
      describeWorkflow({ ...autonomous, factReviewProvider: "not-run" })
        .independentModelReview,
    ).toBe(false);
    expect(
      describeWorkflow({ ...autonomous, factReviewProvider: null })
        .independentModelReview,
    ).toBe(false);
  });

  it("says a human wrote it when no model drafted it", () => {
    const disclosure = describeWorkflow({
      author: "Omar Mohamed",
      humanReviewer: null,
      approvedBy: null,
      draftingProvider: null,
      factReviewProvider: null,
    });
    expect(disclosure.statement).toBe("Reported and written by Omar Mohamed.");
    expect(disclosure.humanReviewed).toBe(false);
  });
});
