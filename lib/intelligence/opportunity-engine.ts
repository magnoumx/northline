import type {
  OpportunitySignal,
  PublicOpportunity,
  ScoredOpportunity,
} from "./types";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Explainable deterministic scoring for the protected editorial workspace.
 * The result is advisory: it never publishes, assigns, or exposes scores to
 * public story payloads.
 */
export function scoreOpportunity(
  signal: OpportunitySignal,
): ScoredOpportunity {
  const score = clampScore(
    signal.searchMomentum * 0.08 +
      signal.unitedStatesRelevance * 0.09 +
      signal.newsImportance * 0.12 +
      signal.sourceStrength * 0.14 +
      signal.originalValueOpportunity * 0.09 +
      signal.visualPotential * 0.04 +
      signal.videoPotential * 0.03 +
      signal.readerUtility * 0.11 +
      signal.existingSiteAuthority * 0.05 +
      signal.commercialSuitability * 0.02 +
      signal.freshness * 0.07 +
      signal.expectedLifespan * 0.04 +
      signal.updatePotential * 0.04 -
      signal.competitionPenalty * 0.02 -
      signal.verificationDifficultyPenalty * 0.03 -
      signal.legalRiskPenalty * 0.05 -
      signal.copyrightRiskPenalty * 0.03 -
      signal.duplicateRiskPenalty * 0.03 -
      signal.sensationalismRiskPenalty * 0.04,
  );
  const reasons = [
    `${signal.sourceFamilies} independent demo source families are represented.`,
    signal.sourceStrength >= 75
      ? "Source strength clears the internal research threshold."
      : "Source strength still needs reporting and primary-source review.",
    signal.readerUtility >= 70
      ? "The topic maps to an explicit reader-information need."
      : "Reader utility is plausible but not yet well established.",
    signal.originalValueOpportunity >= 70
      ? "There is a credible opportunity to add original reporting value."
      : "The original-value case needs a sharper reporting plan.",
  ];
  const cautions = [
    ...(signal.legalRiskPenalty >= 45
      ? ["Elevated sensitivity requires legal or standards review."]
      : []),
    ...(signal.copyrightRiskPenalty >= 45
      ? ["Copyright risk requires a rights and quotation review."]
      : []),
    ...(signal.sourceFamilies < 3
      ? ["Source diversity is below the preferred reporting threshold."]
      : []),
    "All inputs are fictional demo signals and require human verification.",
  ];

  let state: ScoredOpportunity["state"];
  let recommendedFormat: ScoredOpportunity["recommendedFormat"];
  if (
    signal.legalRiskPenalty >= 75 ||
    signal.copyrightRiskPenalty >= 75 ||
    signal.sensationalismRiskPenalty >= 80 ||
    signal.sourceStrength < 30
  ) {
    state = "REJECT";
    recommendedFormat = "NEWS_FLASH";
  } else if (score < 45) {
    state = "WATCH";
    recommendedFormat = "NEWS_FLASH";
  } else if (score < 60 || signal.sourceFamilies < 3) {
    state = "RESEARCH";
    recommendedFormat = "QUICK_BRIEF";
  } else if (signal.existingCoverage && signal.updatePotential >= 72) {
    state = "UPDATE_EXISTING_STORY";
    recommendedFormat = "STANDARD_STORY";
  } else if (signal.evolving && score >= 82) {
    state = "LIVE_COVERAGE";
    recommendedFormat = "LIVE_COVERAGE";
  } else if (signal.videoPotential >= 86 && score >= 68) {
    state = "VIDEO_STORY";
    recommendedFormat = "STANDARD_STORY";
  } else if (signal.visualPotential >= 86 && score >= 68) {
    state = "VISUAL_STORY";
    recommendedFormat = "DEEP_EXPLAINER";
  } else if (score >= 84 && signal.sourceStrength >= 80) {
    state = "DEEP_EXPLAINER";
    recommendedFormat = "DEEP_EXPLAINER";
  } else if (score >= 71) {
    state = "STANDARD_STORY";
    recommendedFormat = "STANDARD_STORY";
  } else {
    state = "QUICK_BRIEF";
    recommendedFormat = "QUICK_BRIEF";
  }

  return {
    id: signal.id,
    topic: signal.topic,
    state,
    internalScore: score,
    reasons,
    cautions,
    recommendedFormat,
    disclosure: "FICTIONAL_INTERNAL_DEMO",
  };
}

export function toPublicOpportunity(
  opportunity: ScoredOpportunity,
): PublicOpportunity {
  return {
    id: opportunity.id,
    topic: opportunity.topic,
    state: opportunity.state,
    recommendedFormat: opportunity.recommendedFormat,
  };
}
