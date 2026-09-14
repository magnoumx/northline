import { describe, expect, it } from "vitest";

import type { ClaimPublicationGateResult } from "../../lib/editorial/claims";
import type { ArticleQualityResult } from "../../lib/editorial/quality-scoring";
import type { SensitiveContentClassification } from "../../lib/editorial/sensitive-content";
import {
  createEditorialWorkflow,
  EditorialTransitionError,
  evaluateEditorialTransition,
  transitionEditorialWorkflow,
  type EditorialTransitionContext,
  type EditorialWorkflow,
} from "../../lib/editorial/state-machine";

const actor = { id: "editor-1", type: "EDITOR" } as const;

const passingClaimGate: ClaimPublicationGateResult = {
  allowed: true,
  blockers: [],
  warnings: [],
  conflictCoverageClaimIds: [],
};

const humanReviewQuality: ArticleQualityResult = {
  score: 90,
  decision: "HUMAN_REVIEW_REQUIRED",
  components: [],
  hardBlockers: [],
  reasons: ["Score requires review."],
};

const sensitive: SensitiveContentClassification = {
  decision: "HUMAN_REVIEW_REQUIRED",
  requiresHumanReview: true,
  matchedTopics: ["PUBLIC_HEALTH"],
  reasons: ["Public health requires human review."],
};

function context(
  overrides: Partial<EditorialTransitionContext> = {},
): EditorialTransitionContext {
  return {
    actor,
    at: "2000-01-01T12:05:00.000Z",
    reason: "Advance after the desk completed its checks.",
    ...overrides,
  };
}

function workflowAt(state: EditorialWorkflow["state"]): EditorialWorkflow {
  return {
    id: "workflow-1",
    state,
    version: 4,
    createdAt: "2000-01-01T12:00:00.000Z",
    updatedAt: "2000-01-01T12:00:00.000Z",
    history: [],
  };
}

describe("editorial state machine", () => {
  it("logs every valid transition with an incremented workflow version", () => {
    const workflow = createEditorialWorkflow(
      "workflow-1",
      "2000-01-01T12:00:00.000Z",
    );
    const normalized = transitionEditorialWorkflow(
      workflow,
      "NORMALIZED",
      context({ expectedVersion: 0 }),
    );

    expect(normalized.state).toBe("NORMALIZED");
    expect(normalized.version).toBe(1);
    expect(normalized.history).toHaveLength(1);
    expect(normalized.history[0]).toMatchObject({
      id: "workflow-1:1",
      from: "SIGNAL_DETECTED",
      to: "NORMALIZED",
      actor,
    });
  });

  it("rejects skipped and stale transitions", () => {
    const workflow = createEditorialWorkflow(
      "workflow-1",
      "2000-01-01T12:00:00.000Z",
    );
    const guard = evaluateEditorialTransition(
      workflow,
      "PUBLISHED",
      context({ expectedVersion: 9 }),
    );

    expect(guard.allowed).toBe(false);
    expect(guard.failures.map((failure) => failure.code)).toEqual(
      expect.arrayContaining(["TRANSITION_NOT_ALLOWED", "VERSION_CONFLICT"]),
    );
    expect(() =>
      transitionEditorialWorkflow(workflow, "PUBLISHED", context()),
    ).toThrow(EditorialTransitionError);
  });

  it("requires recorded primary evidence and sufficient sources at guarded stages", () => {
    const researching = workflowAt("RESEARCHING");
    expect(
      evaluateEditorialTransition(
        researching,
        "RESEARCH_COMPLETE",
        context(),
      ).failures.map((failure) => failure.code),
    ).toContain("PRIMARY_SOURCE_NOT_RECORDED");
    expect(
      evaluateEditorialTransition(
        researching,
        "RESEARCH_COMPLETE",
        context({ hasPrimarySource: true }),
      ).failures.map((failure) => failure.code),
    ).toContain("SOURCES_INSUFFICIENT");
  });

  it("cannot approve a human-review story without a real reviewer record", () => {
    const workflow = workflowAt("HUMAN_REVIEW_REQUIRED");
    const withoutApproval = evaluateEditorialTransition(
      workflow,
      "APPROVED",
      context({
        claimGate: passingClaimGate,
        qualityResult: humanReviewQuality,
        sensitiveContent: sensitive,
      }),
    );
    expect(withoutApproval.failures.map((failure) => failure.code)).toContain(
      "HUMAN_APPROVAL_REQUIRED",
    );
    expect(
      evaluateEditorialTransition(
        workflow,
        "APPROVED",
        context({
          actor: { id: "automation", type: "SYSTEM" },
          claimGate: passingClaimGate,
          qualityResult: humanReviewQuality,
          sensitiveContent: sensitive,
          humanApproval: {
            reviewerId: "reviewer-7",
            approvedAt: "2000-01-01T12:04:00.000Z",
            note: "A system process must not impersonate a reviewer.",
          },
        }),
      ).failures.map((failure) => failure.code),
    ).toContain("HUMAN_APPROVAL_REQUIRED");

    const approved = transitionEditorialWorkflow(
      workflow,
      "APPROVED",
      context({
        actor: { id: "reviewer-7", type: "REVIEWER" },
        claimGate: passingClaimGate,
        qualityResult: humanReviewQuality,
        sensitiveContent: sensitive,
        humanApproval: {
          reviewerId: "reviewer-7",
          approvedAt: "2000-01-01T12:04:00.000Z",
          note: "Claims, context, and risk framing reviewed.",
        },
      }),
    );
    expect(approved.history[0]?.humanReviewerId).toBe("reviewer-7");
  });

  it("requires a correction note so correction history remains meaningful", () => {
    const published = workflowAt("PUBLISHED");
    expect(
      evaluateEditorialTransition(published, "CORRECTED", context()).failures.map(
        (failure) => failure.code,
      ),
    ).toContain("CORRECTION_SUMMARY_REQUIRED");
  });

  it("requires structured explanations for updates and retractions", () => {
    const published = workflowAt("PUBLISHED");
    expect(
      evaluateEditorialTransition(published, "UPDATED", context()).failures.map(
        (failure) => failure.code,
      ),
    ).toContain("UPDATE_SUMMARY_REQUIRED");
    expect(
      evaluateEditorialTransition(published, "RETRACTED", context()).failures.map(
        (failure) => failure.code,
      ),
    ).toContain("RETRACTION_SUMMARY_REQUIRED");
  });

  it("keeps deterministic system publication closed at launch", () => {
    const approved = workflowAt("APPROVED");
    const result = evaluateEditorialTransition(
      approved,
      "PUBLISHED",
      context({
        actor: { id: "publisher-job", type: "SYSTEM" },
        claimGate: passingClaimGate,
        qualityResult: humanReviewQuality,
        sensitiveContent: sensitive,
        autoPublishEnabled: false,
      }),
    );
    expect(result.failures.map((failure) => failure.code)).toContain(
      "HUMAN_PUBLISHER_REQUIRED",
    );
  });
});
