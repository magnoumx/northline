import type { ClaimPublicationGateResult } from "./claims";
import type { ArticleQualityResult } from "./quality-scoring";
import type { SensitiveContentClassification } from "./sensitive-content";
import type {
  EditorialActor,
  EditorialState,
} from "./types";

export const EDITORIAL_TRANSITIONS = {
  SIGNAL_DETECTED: ["NORMALIZED", "REJECTED_EARLY", "ARCHIVED"],
  NORMALIZED: ["CLUSTERED", "REJECTED_EARLY", "ARCHIVED"],
  CLUSTERED: ["CANDIDATE", "REJECTED_EARLY", "ARCHIVED"],
  CANDIDATE: ["RESEARCHING", "REJECTED_EARLY", "ARCHIVED"],
  REJECTED_EARLY: ["CANDIDATE", "ARCHIVED"],
  RESEARCHING: [
    "SOURCE_INSUFFICIENT",
    "RESEARCH_COMPLETE",
    "REJECTED_EARLY",
    "ARCHIVED",
  ],
  SOURCE_INSUFFICIENT: ["RESEARCHING", "REJECTED_EARLY", "ARCHIVED"],
  RESEARCH_COMPLETE: ["OUTLINING", "RESEARCHING", "ARCHIVED"],
  OUTLINING: ["DRAFTING", "RESEARCHING", "REJECTED_EARLY", "ARCHIVED"],
  DRAFTING: ["CLAIM_EXTRACTION", "REVISION_REQUIRED", "ARCHIVED"],
  CLAIM_EXTRACTION: ["FACT_REVIEW", "REVISION_REQUIRED", "ARCHIVED"],
  FACT_REVIEW: [
    "COPY_REVIEW",
    "REVISION_REQUIRED",
    "HUMAN_REVIEW_REQUIRED",
    "RESEARCHING",
    "ARCHIVED",
  ],
  COPY_REVIEW: [
    "SEO_REVIEW",
    "REVISION_REQUIRED",
    "HUMAN_REVIEW_REQUIRED",
    "ARCHIVED",
  ],
  SEO_REVIEW: ["MEDIA_REVIEW", "REVISION_REQUIRED", "ARCHIVED"],
  MEDIA_REVIEW: [
    "RISK_REVIEW",
    "REVISION_REQUIRED",
    "HUMAN_REVIEW_REQUIRED",
    "ARCHIVED",
  ],
  RISK_REVIEW: ["HUMAN_REVIEW_REQUIRED", "REVISION_REQUIRED", "ARCHIVED"],
  REVISION_REQUIRED: [
    "RESEARCHING",
    "DRAFTING",
    "CLAIM_EXTRACTION",
    "FACT_REVIEW",
    "COPY_REVIEW",
    "SEO_REVIEW",
    "MEDIA_REVIEW",
    "RISK_REVIEW",
    "ARCHIVED",
  ],
  HUMAN_REVIEW_REQUIRED: [
    "APPROVED",
    "REVISION_REQUIRED",
    "REJECTED_EARLY",
    "ARCHIVED",
  ],
  APPROVED: ["SCHEDULED", "PUBLISHED", "REVISION_REQUIRED", "ARCHIVED"],
  SCHEDULED: ["APPROVED", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: [
    "DEVELOPING",
    "UPDATED",
    "CORRECTED",
    "RETRACTED",
    "ARCHIVED",
  ],
  DEVELOPING: ["UPDATED", "CORRECTED", "RETRACTED", "ARCHIVED"],
  UPDATED: ["DEVELOPING", "UPDATED", "CORRECTED", "RETRACTED", "ARCHIVED"],
  CORRECTED: ["UPDATED", "CORRECTED", "RETRACTED", "ARCHIVED"],
  RETRACTED: ["ARCHIVED"],
  ARCHIVED: [],
} as const satisfies Readonly<
  Record<EditorialState, readonly EditorialState[]>
>;

export interface HumanApproval {
  readonly reviewerId: string;
  readonly approvedAt: string;
  readonly note: string;
}

export interface EditorialTransitionContext {
  readonly actor: EditorialActor;
  readonly at: string;
  readonly reason: string;
  readonly expectedVersion?: number;
  readonly hasPrimarySource?: boolean;
  readonly sourcesSufficient?: boolean;
  readonly claimGate?: ClaimPublicationGateResult;
  readonly qualityResult?: ArticleQualityResult;
  readonly sensitiveContent?: SensitiveContentClassification;
  readonly humanApproval?: HumanApproval;
  readonly scheduledFor?: string;
  readonly correctionSummary?: string;
  readonly updateSummary?: string;
  readonly retractionSummary?: string;
  readonly autoPublishEnabled?: boolean;
}

export interface EditorialTransitionEvent {
  readonly id: string;
  readonly workflowId: string;
  readonly version: number;
  readonly from: EditorialState;
  readonly to: EditorialState;
  readonly actor: EditorialActor;
  readonly at: string;
  readonly reason: string;
  readonly claimGateAllowed?: boolean;
  readonly qualityDecision?: ArticleQualityResult["decision"];
  readonly sensitiveReviewDecision?: SensitiveContentClassification["decision"];
  readonly humanReviewerId?: string;
  readonly scheduledFor?: string;
  readonly correctionSummary?: string;
  readonly updateSummary?: string;
  readonly retractionSummary?: string;
}

export interface EditorialWorkflow {
  readonly id: string;
  readonly state: EditorialState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly EditorialTransitionEvent[];
}

export type TransitionGuardCode =
  | "TRANSITION_NOT_ALLOWED"
  | "VERSION_CONFLICT"
  | "INVALID_TIMESTAMP"
  | "NON_MONOTONIC_TIMESTAMP"
  | "MISSING_ACTOR"
  | "MISSING_REASON"
  | "PRIMARY_SOURCE_NOT_RECORDED"
  | "SOURCES_INSUFFICIENT"
  | "CLAIM_GATE_NOT_PASSED"
  | "QUALITY_GATE_NOT_PASSED"
  | "SENSITIVE_CLASSIFICATION_REQUIRED"
  | "HUMAN_APPROVAL_REQUIRED"
  | "INVALID_HUMAN_APPROVAL"
  | "SCHEDULE_TIME_REQUIRED"
  | "SCHEDULE_NOT_IN_FUTURE"
  | "SCHEDULE_NOT_DUE"
  | "CORRECTION_SUMMARY_REQUIRED"
  | "UPDATE_SUMMARY_REQUIRED"
  | "RETRACTION_SUMMARY_REQUIRED"
  | "HUMAN_PUBLISHER_REQUIRED";

export interface TransitionGuardFailure {
  readonly code: TransitionGuardCode;
  readonly message: string;
}

export interface TransitionGuardResult {
  readonly allowed: boolean;
  readonly failures: readonly TransitionGuardFailure[];
}

export class EditorialTransitionError extends Error {
  readonly failures: readonly TransitionGuardFailure[];

  constructor(failures: readonly TransitionGuardFailure[]) {
    super(failures.map((failure) => failure.message).join(" "));
    this.name = "EditorialTransitionError";
    this.failures = failures;
  }
}

function timestampValue(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function latestScheduledFor(workflow: EditorialWorkflow): string | undefined {
  for (let index = workflow.history.length - 1; index >= 0; index -= 1) {
    const event = workflow.history[index];
    if (event.to === "SCHEDULED" && event.scheduledFor) {
      return event.scheduledFor;
    }
  }
  return undefined;
}

function latestApprovalHasHumanReview(workflow: EditorialWorkflow): boolean {
  for (let index = workflow.history.length - 1; index >= 0; index -= 1) {
    const event = workflow.history[index];
    if (event.to === "APPROVED") {
      return Boolean(event.humanReviewerId);
    }
  }
  return false;
}

function qualityCanAdvance(result: ArticleQualityResult | undefined): boolean {
  return (
    result?.decision === "AUTO_PUBLISH_ELIGIBLE" ||
    result?.decision === "HUMAN_REVIEW_REQUIRED"
  );
}

function needsHumanApproval(context: EditorialTransitionContext): boolean {
  return Boolean(
    context.sensitiveContent?.requiresHumanReview ||
      context.qualityResult?.decision === "HUMAN_REVIEW_REQUIRED",
  );
}

function validHumanApproval(
  approval: HumanApproval | undefined,
  actor: EditorialActor,
  workflowUpdatedAt: number | null,
  transitionAt: number | null,
): boolean {
  if (
    !approval ||
    !approval.reviewerId.trim() ||
    !approval.note.trim() ||
    actor.type === "SYSTEM" ||
    approval.reviewerId !== actor.id ||
    transitionAt === null
  ) {
    return false;
  }
  const approvedAt = timestampValue(approval.approvedAt);
  return (
    approvedAt !== null &&
    (workflowUpdatedAt === null || approvedAt >= workflowUpdatedAt) &&
    approvedAt <= transitionAt
  );
}

export function createEditorialWorkflow(
  id: string,
  createdAt: string,
): EditorialWorkflow {
  if (!id.trim()) {
    throw new TypeError("Workflow id must not be empty");
  }
  if (timestampValue(createdAt) === null) {
    throw new TypeError("createdAt must be a valid timestamp");
  }
  return {
    id,
    state: "SIGNAL_DETECTED",
    version: 0,
    createdAt,
    updatedAt: createdAt,
    history: [],
  };
}

export function evaluateEditorialTransition(
  workflow: EditorialWorkflow,
  to: EditorialState,
  context: EditorialTransitionContext,
): TransitionGuardResult {
  const failures: TransitionGuardFailure[] = [];
  const transitionAt = timestampValue(context.at);
  const currentUpdatedAt = timestampValue(workflow.updatedAt);
  const isAllowed = (
    EDITORIAL_TRANSITIONS[workflow.state] as readonly EditorialState[]
  ).includes(to);

  if (!isAllowed) {
    failures.push({
      code: "TRANSITION_NOT_ALLOWED",
      message: `${workflow.state} cannot transition to ${to}.`,
    });
  }
  if (
    context.expectedVersion !== undefined &&
    context.expectedVersion !== workflow.version
  ) {
    failures.push({
      code: "VERSION_CONFLICT",
      message: `Expected version ${context.expectedVersion}, but the workflow is at version ${workflow.version}.`,
    });
  }
  if (transitionAt === null) {
    failures.push({
      code: "INVALID_TIMESTAMP",
      message: "The transition timestamp is invalid.",
    });
  } else if (
    currentUpdatedAt !== null &&
    transitionAt < currentUpdatedAt
  ) {
    failures.push({
      code: "NON_MONOTONIC_TIMESTAMP",
      message: "A transition cannot predate the workflow's latest event.",
    });
  }
  if (!context.actor.id.trim()) {
    failures.push({
      code: "MISSING_ACTOR",
      message: "Every transition must identify an actor.",
    });
  }
  if (!context.reason.trim()) {
    failures.push({
      code: "MISSING_REASON",
      message: "Every transition must record a reason.",
    });
  }

  if (to === "RESEARCH_COMPLETE" && !context.hasPrimarySource) {
    failures.push({
      code: "PRIMARY_SOURCE_NOT_RECORDED",
      message: "RESEARCH_COMPLETE requires recorded primary evidence.",
    });
  }
  if (to === "RESEARCH_COMPLETE" && !context.sourcesSufficient) {
    failures.push({
      code: "SOURCES_INSUFFICIENT",
      message: "Research completion requires a sufficient source dossier.",
    });
  }
  if (to === "COPY_REVIEW" && !context.claimGate?.allowed) {
    failures.push({
      code: "CLAIM_GATE_NOT_PASSED",
      message: "Fact review cannot advance while the central-claim gate is blocked.",
    });
  }

  if (to === "APPROVED") {
    if (!context.claimGate?.allowed) {
      failures.push({
        code: "CLAIM_GATE_NOT_PASSED",
        message: "Approval requires the central-claim publication gate to pass.",
      });
    }
    if (!qualityCanAdvance(context.qualityResult)) {
      failures.push({
        code: "QUALITY_GATE_NOT_PASSED",
        message: "Approval requires a publishable quality decision.",
      });
    }
    if (!context.sensitiveContent) {
      failures.push({
        code: "SENSITIVE_CLASSIFICATION_REQUIRED",
        message: "Approval requires a current sensitive-content classification.",
      });
    }

    if (
      !validHumanApproval(
        context.humanApproval,
        context.actor,
        currentUpdatedAt,
        transitionAt,
      )
    ) {
      failures.push({
        code: "HUMAN_APPROVAL_REQUIRED",
        message: "Every approval requires a valid, recorded human review.",
      });
    }
  }

  if (to === "SCHEDULED" || to === "PUBLISHED") {
    if (!context.claimGate?.allowed) {
      failures.push({
        code: "CLAIM_GATE_NOT_PASSED",
        message: `${to} requires a fresh passing central-claim gate.`,
      });
    }
    if (!qualityCanAdvance(context.qualityResult)) {
      failures.push({
        code: "QUALITY_GATE_NOT_PASSED",
        message: `${to} requires a fresh publishable quality decision.`,
      });
    }
    if (!context.sensitiveContent) {
      failures.push({
        code: "SENSITIVE_CLASSIFICATION_REQUIRED",
        message: `${to} requires a fresh sensitive-content classification.`,
      });
    }
    if (
      needsHumanApproval(context) &&
      !latestApprovalHasHumanReview(workflow)
    ) {
      failures.push({
        code: "HUMAN_APPROVAL_REQUIRED",
        message: "Sensitive or review-routed content needs recorded human approval.",
      });
    }
    if (context.actor.type === "SYSTEM" && !context.autoPublishEnabled) {
      failures.push({
        code: "HUMAN_PUBLISHER_REQUIRED",
        message: `${to} requires a human publisher while auto-publication is disabled.`,
      });
    }
  }

  if (to === "SCHEDULED") {
    const scheduledFor = context.scheduledFor
      ? timestampValue(context.scheduledFor)
      : null;
    if (scheduledFor === null) {
      failures.push({
        code: "SCHEDULE_TIME_REQUIRED",
        message: "Scheduling requires a valid publication timestamp.",
      });
    } else if (transitionAt !== null && scheduledFor <= transitionAt) {
      failures.push({
        code: "SCHEDULE_NOT_IN_FUTURE",
        message: "A scheduled publication time must be after the transition time.",
      });
    }
  }

  if (to === "PUBLISHED" && workflow.state === "SCHEDULED") {
    const scheduledFor = latestScheduledFor(workflow);
    const scheduledAt = scheduledFor ? timestampValue(scheduledFor) : null;
    if (
      scheduledAt !== null &&
      transitionAt !== null &&
      transitionAt < scheduledAt
    ) {
      failures.push({
        code: "SCHEDULE_NOT_DUE",
        message: `The story is scheduled for ${scheduledFor}.`,
      });
    }
  }

  if (to === "CORRECTED" && !context.correctionSummary?.trim()) {
    failures.push({
      code: "CORRECTION_SUMMARY_REQUIRED",
      message: "A correction transition must preserve a correction summary.",
    });
  }
  if (to === "UPDATED" && !context.updateSummary?.trim()) {
    failures.push({
      code: "UPDATE_SUMMARY_REQUIRED",
      message: "An update transition must explain the material change.",
    });
  }
  if (to === "RETRACTED" && !context.retractionSummary?.trim()) {
    failures.push({
      code: "RETRACTION_SUMMARY_REQUIRED",
      message: "A retraction transition must preserve a public-facing explanation.",
    });
  }

  return { allowed: failures.length === 0, failures };
}

export function transitionEditorialWorkflow(
  workflow: EditorialWorkflow,
  to: EditorialState,
  context: EditorialTransitionContext,
): EditorialWorkflow {
  const guard = evaluateEditorialTransition(workflow, to, context);
  if (!guard.allowed) {
    throw new EditorialTransitionError(guard.failures);
  }

  const version = workflow.version + 1;
  const event: EditorialTransitionEvent = {
    id: `${workflow.id}:${version}`,
    workflowId: workflow.id,
    version,
    from: workflow.state,
    to,
    actor: { ...context.actor },
    at: context.at,
    reason: context.reason.trim(),
    claimGateAllowed: context.claimGate?.allowed,
    qualityDecision: context.qualityResult?.decision,
    sensitiveReviewDecision: context.sensitiveContent?.decision,
    humanReviewerId: context.humanApproval?.reviewerId,
    scheduledFor: context.scheduledFor,
    correctionSummary: context.correctionSummary?.trim(),
    updateSummary: context.updateSummary?.trim(),
    retractionSummary: context.retractionSummary?.trim(),
  };

  return {
    ...workflow,
    state: to,
    version,
    updatedAt: context.at,
    history: [...workflow.history, event],
  };
}
