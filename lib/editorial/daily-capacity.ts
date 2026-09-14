export type DailyCapacityPolicy = {
  /** Stories the newsroom intends to run on an ordinary day. */
  baseDailyLimit: number;
  /**
   * Slots inside the base limit that only major stories may take, so a quiet
   * morning cannot spend the whole day's capacity before real news breaks.
   */
  breakingReserve: number;
  /** Extra slots a major story may claim after the base limit is exhausted. */
  breakingOverflow: number;
  /** Priority score at or above which a story counts as major. */
  breakingScore: number;
  dailyCostLimitUsd: number;
  estimatedCostPerStoryUsd: number;
};

export type DailyCapacityState = {
  startedToday: number;
  spentUsd: number;
};

export type DailyCapacityDecision = {
  /** Slots any eligible story may take right now. */
  ordinarySlots: number;
  /** Additional slots reserved for stories at or above `breakingScore`. */
  breakingSlots: number;
  /** Set when nothing may run at all. */
  stopReason: "daily_cost_limit_reached" | "daily_story_limit_reached" | null;
};

export type CapacityCandidate = {
  trendId: string;
  priorityScore: number;
};

export function decideDailyCapacity(
  policy: DailyCapacityPolicy,
  state: DailyCapacityState,
): DailyCapacityDecision {
  const affordable = Math.max(
    0,
    Math.floor(
      (policy.dailyCostLimitUsd - state.spentUsd) /
        Math.max(0.0001, policy.estimatedCostPerStoryUsd),
    ),
  );
  if (affordable === 0) {
    return {
      ordinarySlots: 0,
      breakingSlots: 0,
      stopReason: "daily_cost_limit_reached",
    };
  }

  const ceiling = policy.baseDailyLimit + policy.breakingOverflow;
  const totalRemaining = Math.min(
    affordable,
    Math.max(0, ceiling - state.startedToday),
  );
  if (totalRemaining === 0) {
    return {
      ordinarySlots: 0,
      breakingSlots: 0,
      stopReason: "daily_story_limit_reached",
    };
  }

  // Ordinary stories stop at the base limit minus the reserve. Everything past
  // that point - the reserve itself and the overflow - is for major news only.
  const ordinaryCeiling = Math.max(
    0,
    policy.baseDailyLimit - policy.breakingReserve,
  );
  const ordinarySlots = Math.min(
    totalRemaining,
    Math.max(0, ordinaryCeiling - state.startedToday),
  );

  return {
    ordinarySlots,
    breakingSlots: totalRemaining - ordinarySlots,
    stopReason: null,
  };
}

/**
 * Fills the day's capacity by importance rather than by arrival order. A story
 * below the breaking score can only take an ordinary slot; the reserved and
 * overflow slots stay available for major news for the rest of the day.
 */
export function allocateDailyCapacity<T extends CapacityCandidate>(
  candidates: readonly T[],
  policy: Pick<DailyCapacityPolicy, "breakingScore">,
  decision: DailyCapacityDecision,
): T[] {
  const ranked = [...candidates].sort(
    (left, right) => right.priorityScore - left.priorityScore,
  );

  let ordinary = decision.ordinarySlots;
  let breaking = decision.breakingSlots;
  const selected: T[] = [];

  for (const candidate of ranked) {
    const isBreaking = candidate.priorityScore >= policy.breakingScore;
    if (isBreaking && breaking > 0) {
      breaking -= 1;
      selected.push(candidate);
      continue;
    }
    if (ordinary > 0) {
      ordinary -= 1;
      selected.push(candidate);
      continue;
    }
    if (isBreaking) continue;
    break;
  }

  return selected;
}
