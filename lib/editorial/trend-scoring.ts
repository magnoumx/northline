export const TREND_CONTRIBUTION_LIMITS = {
  usSearchDemand: 15,
  freshnessAndVelocity: 15,
  newsImportance: 15,
  sourceConfidence: 15,
  originalValueOpportunity: 15,
  audienceRelevance: 10,
  visualPotential: 5,
  commercialSuitability: 5,
  followUpPotential: 5,
} as const;

export const TREND_PENALTY_LIMITS = {
  legalAndReputationRisk: 30,
  weakVerification: 30,
  duplicateCoverage: 20,
  copyrightRisk: 30,
  sensationalismRisk: 20,
} as const;

export type TrendContributionKey = keyof typeof TREND_CONTRIBUTION_LIMITS;
export type TrendPenaltyKey = keyof typeof TREND_PENALTY_LIMITS;

export interface ScoringSignal {
  /** A normalized severity or strength from 0 through 1. */
  readonly value: number;
  /** Editor-facing evidence for this input, never an opaque model score. */
  readonly explanation: string;
}

export type TrendContributionSignals = Readonly<
  Record<TrendContributionKey, ScoringSignal>
>;

export type TrendPenaltySignals = Readonly<
  Record<TrendPenaltyKey, ScoringSignal>
>;

export interface TrendScoringInput {
  readonly contributions: TrendContributionSignals;
  readonly penalties: TrendPenaltySignals;
}

export interface TrendScoringConfig {
  readonly contributionLimits: Readonly<Record<TrendContributionKey, number>>;
  readonly penaltyLimits: Readonly<Record<TrendPenaltyKey, number>>;
}

export interface TrendScoreLineItem<Key extends string> {
  readonly key: Key;
  readonly normalizedValue: number;
  readonly maximumPoints: number;
  readonly points: number;
  readonly explanation: string;
}

export interface TrendScoreResult {
  readonly score: number;
  readonly rawScore: number;
  readonly contributionSubtotal: number;
  readonly penaltySubtotal: number;
  readonly contributions: readonly TrendScoreLineItem<TrendContributionKey>[];
  readonly penalties: readonly TrendScoreLineItem<TrendPenaltyKey>[];
  readonly explanation: readonly string[];
}

export const DEFAULT_TREND_SCORING_CONFIG: TrendScoringConfig = Object.freeze({
  contributionLimits: Object.freeze({ ...TREND_CONTRIBUTION_LIMITS }),
  penaltyLimits: Object.freeze({ ...TREND_PENALTY_LIMITS }),
});

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertSignal(
  signal: ScoringSignal,
  key: TrendContributionKey | TrendPenaltyKey,
): void {
  if (!Number.isFinite(signal.value) || signal.value < 0 || signal.value > 1) {
    throw new RangeError(`${key} must have a normalized value between 0 and 1`);
  }
  if (!signal.explanation.trim()) {
    throw new TypeError(`${key} must include an editorial explanation`);
  }
}

function assertConfig(config: TrendScoringConfig): void {
  const contributionTotal = Object.values(config.contributionLimits).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (Math.abs(contributionTotal - 100) > Number.EPSILON) {
    throw new RangeError("Trend contribution limits must total 100 points");
  }

  for (const [key, value] of Object.entries({
    ...config.contributionLimits,
    ...config.penaltyLimits,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${key} must have a finite, non-negative point limit`);
    }
  }
}

export function createTrendScoringConfig(
  contributionLimits: Readonly<Record<TrendContributionKey, number>>,
  penaltyLimits: Readonly<Record<TrendPenaltyKey, number>> = TREND_PENALTY_LIMITS,
): TrendScoringConfig {
  const config: TrendScoringConfig = {
    contributionLimits: { ...contributionLimits },
    penaltyLimits: { ...penaltyLimits },
  };
  assertConfig(config);
  return config;
}

export function scoreTrend(
  input: TrendScoringInput,
  config: TrendScoringConfig = DEFAULT_TREND_SCORING_CONFIG,
): TrendScoreResult {
  assertConfig(config);

  const contributions = (
    Object.keys(config.contributionLimits) as TrendContributionKey[]
  ).map((key) => {
    const signal = input.contributions[key];
    assertSignal(signal, key);
    return {
      key,
      normalizedValue: signal.value,
      maximumPoints: config.contributionLimits[key],
      points: round(signal.value * config.contributionLimits[key]),
      explanation: signal.explanation.trim(),
    };
  });

  const penalties = (Object.keys(config.penaltyLimits) as TrendPenaltyKey[]).map(
    (key) => {
      const signal = input.penalties[key];
      assertSignal(signal, key);
      return {
        key,
        normalizedValue: signal.value,
        maximumPoints: config.penaltyLimits[key],
        points: round(signal.value * config.penaltyLimits[key]),
        explanation: signal.explanation.trim(),
      };
    },
  );

  const contributionSubtotal = round(
    contributions.reduce((sum, item) => sum + item.points, 0),
  );
  const penaltySubtotal = round(
    penalties.reduce((sum, item) => sum + item.points, 0),
  );
  const rawScore = round(contributionSubtotal - penaltySubtotal);
  const score = Math.min(100, Math.max(0, rawScore));

  const strongestContributions = [...contributions]
    .filter((item) => item.points > 0)
    .sort((left, right) => right.points - left.points)
    .slice(0, 3)
    .map(
      (item) =>
        `${item.key} added ${item.points} points: ${item.explanation}`,
    );
  const strongestPenalties = [...penalties]
    .filter((item) => item.points > 0)
    .sort((left, right) => right.points - left.points)
    .slice(0, 3)
    .map(
      (item) =>
        `${item.key} removed ${item.points} points: ${item.explanation}`,
    );

  return {
    score,
    rawScore,
    contributionSubtotal,
    penaltySubtotal,
    contributions,
    penalties,
    explanation: [...strongestContributions, ...strongestPenalties],
  };
}
