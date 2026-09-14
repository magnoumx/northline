import type { ClaimPublicationGateResult } from "./claims";
import type { SensitiveContentClassification } from "./sensitive-content";
import type { SourceSetAssessment } from "./source-tiers";

export const QUALITY_COMPONENT_LIMITS = {
  factualVerification: 25,
  sourceQualityAndIndependence: 15,
  originalReaderValue: 15,
  searchIntentSatisfaction: 10,
  writingQuality: 10,
  headlineAccuracy: 5,
  contextAndCompleteness: 5,
  mediaQualityAndRights: 5,
  technicalSeo: 5,
  trustAndTransparency: 5,
} as const;

export type QualityComponentKey = keyof typeof QUALITY_COMPONENT_LIMITS;

export interface QualityComponentInput {
  readonly score: number;
  readonly explanation: string;
}

export type QualityComponentInputs = Readonly<
  Record<QualityComponentKey, QualityComponentInput>
>;

export interface QualityThresholds {
  readonly autoPublishMinScore: number;
  readonly humanReviewMinScore: number;
  readonly rejectBelowScore: number;
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = Object.freeze({
  autoPublishMinScore: 94,
  humanReviewMinScore: 82,
  rejectBelowScore: 70,
});

export type MediaRightsStatus =
  | "CLEARED"
  | "NOT_APPLICABLE"
  | "UNRESOLVED";

export interface ArticleQualityInput {
  readonly components: QualityComponentInputs;
  readonly claimGate: ClaimPublicationGateResult;
  readonly sourceAssessment: SourceSetAssessment;
  readonly sensitiveContent: SensitiveContentClassification;
  readonly coreFactualChecksPassed: boolean;
  readonly mediaRightsStatus: MediaRightsStatus;
}

export type QualityDecision =
  | "BLOCKED"
  | "REJECT"
  | "REVISION_REQUIRED"
  | "HUMAN_REVIEW_REQUIRED"
  | "AUTO_PUBLISH_ELIGIBLE";

export type QualityHardBlockerCode =
  | "CORE_FACTUAL_CHECK_FAILED"
  | "CLAIM_GATE_FAILED"
  | "SOURCE_STANDARD_FAILED"
  | "MEDIA_RIGHTS_UNRESOLVED";

export interface QualityHardBlocker {
  readonly code: QualityHardBlockerCode;
  readonly message: string;
}

export interface QualityScoreLineItem {
  readonly key: QualityComponentKey;
  readonly score: number;
  readonly maximumScore: number;
  readonly explanation: string;
}

export interface ArticleQualityResult {
  readonly score: number;
  readonly decision: QualityDecision;
  readonly components: readonly QualityScoreLineItem[];
  readonly hardBlockers: readonly QualityHardBlocker[];
  readonly reasons: readonly string[];
}

function validateThresholds(thresholds: QualityThresholds): void {
  const values = [
    thresholds.rejectBelowScore,
    thresholds.humanReviewMinScore,
    thresholds.autoPublishMinScore,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new RangeError("Quality thresholds must be finite values between 0 and 100");
  }
  if (
    !(
      thresholds.rejectBelowScore < thresholds.humanReviewMinScore &&
      thresholds.humanReviewMinScore < thresholds.autoPublishMinScore
    )
  ) {
    throw new RangeError(
      "Quality thresholds must increase from rejection to human review to auto-publication",
    );
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreArticleQuality(
  input: ArticleQualityInput,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS,
): ArticleQualityResult {
  validateThresholds(thresholds);

  const components = (
    Object.keys(QUALITY_COMPONENT_LIMITS) as QualityComponentKey[]
  ).map((key) => {
    const component = input.components[key];
    const maximumScore = QUALITY_COMPONENT_LIMITS[key];
    if (
      !Number.isFinite(component.score) ||
      component.score < 0 ||
      component.score > maximumScore
    ) {
      throw new RangeError(
        `${key} must score between 0 and ${maximumScore} points`,
      );
    }
    if (!component.explanation.trim()) {
      throw new TypeError(`${key} must include an editorial explanation`);
    }
    return {
      key,
      score: round(component.score),
      maximumScore,
      explanation: component.explanation.trim(),
    };
  });

  const score = round(
    components.reduce((total, component) => total + component.score, 0),
  );
  const hardBlockers: QualityHardBlocker[] = [];

  if (!input.coreFactualChecksPassed) {
    hardBlockers.push({
      code: "CORE_FACTUAL_CHECK_FAILED",
      message: "A failed core factual check overrides the numeric quality score.",
    });
  }
  if (!input.claimGate.allowed) {
    hardBlockers.push({
      code: "CLAIM_GATE_FAILED",
      message: `The claim gate has ${input.claimGate.blockers.length} blocking finding(s).`,
    });
  }
  if (
    input.sourceAssessment.use !== "CENTRAL_CLAIM" ||
    !input.sourceAssessment.meetsPublicationStandard
  ) {
    hardBlockers.push({
      code: "SOURCE_STANDARD_FAILED",
      message:
        "The source set has not passed the central-claim publication standard.",
    });
  }
  if (input.mediaRightsStatus === "UNRESOLVED") {
    hardBlockers.push({
      code: "MEDIA_RIGHTS_UNRESOLVED",
      message: "Media with unresolved rights must be removed or cleared before publication.",
    });
  }

  const reasons: string[] = [];
  let decision: QualityDecision;
  if (hardBlockers.length > 0) {
    decision = "BLOCKED";
    reasons.push(...hardBlockers.map((blocker) => blocker.message));
  } else if (score < thresholds.rejectBelowScore) {
    decision = "REJECT";
    reasons.push(
      `The ${score}-point score is below the ${thresholds.rejectBelowScore}-point rejection threshold.`,
    );
  } else if (score < thresholds.humanReviewMinScore) {
    decision = "REVISION_REQUIRED";
    reasons.push(
      `The ${score}-point score needs revision before the ${thresholds.humanReviewMinScore}-point review threshold.`,
    );
  } else if (
    score < thresholds.autoPublishMinScore ||
    input.sensitiveContent.requiresHumanReview
  ) {
    decision = "HUMAN_REVIEW_REQUIRED";
    reasons.push(
      input.sensitiveContent.requiresHumanReview
        ? "Risk classification requires a human decision regardless of score."
        : `The score meets human-review standards but is below the ${thresholds.autoPublishMinScore}-point auto-publication threshold.`,
    );
  } else {
    decision = "AUTO_PUBLISH_ELIGIBLE";
    reasons.push(
      `The score meets the ${thresholds.autoPublishMinScore}-point threshold and all deterministic gates passed.`,
    );
  }

  if (input.mediaRightsStatus === "NOT_APPLICABLE") {
    reasons.push("No media is present; missing media alone does not reject a strong story.");
  }

  return { score, decision, components, hardBlockers, reasons };
}
