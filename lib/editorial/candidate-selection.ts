export interface CandidateSelectionInput {
  usSearchDemand: number;
  newsImportance: number;
  sourceAvailability: number;
  originalValueOpportunity: number;
  visualAvailability: number;
  advertiserSafety: number;
  audienceFit: number;
  existingSiteAuthority: number;
  duplicateRisk: number;
  legalRisk: number;
  productionCost: number;
  expectedArticleLifespan: number;
}

export interface CandidateSelectionResult {
  score: number;
  recommendation: "HOLD" | "HUMAN_REVIEW" | "PRIORITIZE";
  publicLabel: "Developing" | "Rising" | "Surging";
  explanation: Array<{ factor: keyof CandidateSelectionInput; points: number }>;
}

const weights: Record<keyof CandidateSelectionInput, number> = {
  usSearchDemand: 10,
  newsImportance: 15,
  sourceAvailability: 12,
  originalValueOpportunity: 10,
  visualAvailability: 5,
  advertiserSafety: 7,
  audienceFit: 10,
  existingSiteAuthority: 6,
  duplicateRisk: -10,
  legalRisk: -10,
  productionCost: -7,
  expectedArticleLifespan: 8,
};

export function evaluateCandidate(
  input: CandidateSelectionInput,
): CandidateSelectionResult {
  const explanation = (Object.keys(weights) as Array<keyof CandidateSelectionInput>).map(
    (factor) => {
      const value = input[factor];
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(`${factor} must be between 0 and 1`);
      }
      return { factor, points: Math.round(value * weights[factor] * 10) / 10 };
    },
  );
  const raw = explanation.reduce((sum, item) => sum + item.points, 0);
  // Positive factors total 83. Normalize without hiding risk penalties.
  const score = Math.max(0, Math.min(100, Math.round((raw / 83) * 100)));
  const criticalEvidenceFailure =
    input.sourceAvailability < 0.5 ||
    input.legalRisk >= 0.8 ||
    input.duplicateRisk >= 0.9;
  const recommendation = criticalEvidenceFailure
    ? "HOLD"
    : score >= 68
      ? "PRIORITIZE"
      : "HUMAN_REVIEW";
  return {
    score,
    recommendation,
    publicLabel: score >= 75 ? "Surging" : score >= 50 ? "Rising" : "Developing",
    explanation,
  };
}

export interface AutomationReadiness {
  shadowDays: number;
  unresolvedCriticalSourcingFailures: number;
  unresolvedCriticalCopyrightFailures: number;
  unresolvedCriticalSecurityFailures: number;
  categoryAllowed: boolean;
  killSwitchTested: boolean;
  correctionDrillCompleted: boolean;
  maximumDailyCap: number;
}

export function canEnableLimitedAutomation(readiness: AutomationReadiness): boolean {
  return (
    readiness.shadowDays >= 30 &&
    readiness.unresolvedCriticalSourcingFailures === 0 &&
    readiness.unresolvedCriticalCopyrightFailures === 0 &&
    readiness.unresolvedCriticalSecurityFailures === 0 &&
    readiness.categoryAllowed &&
    readiness.killSwitchTested &&
    readiness.correctionDrillCompleted &&
    Number.isSafeInteger(readiness.maximumDailyCap) &&
    readiness.maximumDailyCap >= 0 &&
    readiness.maximumDailyCap <= 10
  );
}

export function publicationCapacity(input: {
  exceptionalNewsDay: boolean;
  alreadyPublished: number;
}): { remaining: number; forcedMinimum: 0; cap: 5 | 10 } {
  if (!Number.isSafeInteger(input.alreadyPublished) || input.alreadyPublished < 0) {
    throw new RangeError("alreadyPublished must be a non-negative integer");
  }
  const cap = input.exceptionalNewsDay ? 10 : 5;
  return {
    remaining: Math.max(0, cap - input.alreadyPublished),
    forcedMinimum: 0,
    cap,
  };
}

