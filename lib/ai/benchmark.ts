import { sha256Base64Url } from "../security/crypto";

export const BENCHMARK_TASK_FAMILIES = [
  "trend_classification",
  "entity_normalization",
  "claim_extraction",
  "evidence_comparison",
  "article_outline",
  "article_draft",
  "fact_review",
  "copy_edit",
  "headline_and_seo",
  "published_dossier_answer",
] as const;

export const BENCHMARK_SCENARIOS = [
  "straightforward_public_record",
  "conflicting_sources",
  "material_unknowns",
  "sensitive_high_risk_claims",
  "long_context_with_distractors",
] as const;

export type BenchmarkTaskFamily =
  (typeof BENCHMARK_TASK_FAMILIES)[number];

export interface BlindBenchmarkTask {
  readonly id: string;
  readonly family: BenchmarkTaskFamily;
  readonly scenario: (typeof BENCHMARK_SCENARIOS)[number];
  readonly risk: "low" | "high";
  readonly fixturePolicy: "SYNTHETIC_OR_LICENSED";
  readonly rubric: readonly [
    "factual_accuracy",
    "evidence_fidelity",
    "schema_compliance",
    "uncertainty_calibration",
    "editorial_usefulness",
  ];
}

export interface BlindCandidateScore {
  readonly factualAccuracy: number;
  readonly evidenceFidelity: number;
  readonly schemaCompliance: number;
  readonly uncertaintyCalibration: number;
  readonly editorialUsefulness: number;
  readonly hardFailure?: boolean;
}

export function createBlindBenchmarkManifest(): readonly BlindBenchmarkTask[] {
  return BENCHMARK_TASK_FAMILIES.flatMap((family) =>
    BENCHMARK_SCENARIOS.map((scenario, index) => ({
      id: `v4-${family}-${index + 1}`,
      family,
      scenario,
      risk:
        scenario === "sensitive_high_risk_claims" ||
        family === "article_draft" ||
        family === "fact_review"
          ? "high"
          : "low",
      fixturePolicy: "SYNTHETIC_OR_LICENSED" as const,
      rubric: [
        "factual_accuracy",
        "evidence_fidelity",
        "schema_compliance",
        "uncertainty_calibration",
        "editorial_usefulness",
      ] as const,
    })),
  );
}

export async function blindCandidateId(
  provider: string,
  model: string,
  runSalt: string,
): Promise<string> {
  if (
    !provider.trim() ||
    !model.trim() ||
    !/^[A-Za-z0-9_-]{16,128}$/u.test(runSalt)
  ) {
    throw new TypeError("Blind benchmark identity input is invalid.");
  }
  const digest = await sha256Base64Url(
    `${runSalt}\u0000${provider.trim()}\u0000${model.trim()}`,
  );
  return `candidate-${digest.slice(0, 12)}`;
}

export function weightedBlindScore(score: BlindCandidateScore): number {
  if (score.hardFailure) return 0;
  const values = [
    score.factualAccuracy,
    score.evidenceFidelity,
    score.schemaCompliance,
    score.uncertaintyCalibration,
    score.editorialUsefulness,
  ];
  if (
    values.some(
      (value) => !Number.isFinite(value) || value < 0 || value > 100,
    )
  ) {
    throw new RangeError("Benchmark scores must be from 0 through 100.");
  }
  return Number(
    (
      score.factualAccuracy * 0.3 +
      score.evidenceFidelity * 0.3 +
      score.schemaCompliance * 0.15 +
      score.uncertaintyCalibration * 0.15 +
      score.editorialUsefulness * 0.1
    ).toFixed(2),
  );
}
