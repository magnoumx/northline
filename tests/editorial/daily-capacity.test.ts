import { describe, expect, it } from "vitest";
import {
  allocateDailyCapacity,
  decideDailyCapacity,
  type DailyCapacityPolicy,
} from "../../lib/editorial/daily-capacity";

const policy: DailyCapacityPolicy = {
  baseDailyLimit: 5,
  breakingReserve: 2,
  breakingOverflow: 3,
  breakingScore: 80,
  dailyCostLimitUsd: 10,
  estimatedCostPerStoryUsd: 0.6,
};

const fresh = { startedToday: 0, spentUsd: 0 };

describe("daily capacity", () => {
  it("keeps slots in reserve while ordinary news is running", () => {
    const decision = decideDailyCapacity(policy, fresh);
    // Three ordinary slots; two reserved plus three overflow stay for majors.
    expect(decision.ordinarySlots).toBe(3);
    expect(decision.breakingSlots).toBe(5);
    expect(decision.stopReason).toBeNull();
  });

  it("still admits a major story after ordinary capacity is spent", () => {
    const decision = decideDailyCapacity(policy, {
      startedToday: 3,
      spentUsd: 1.8,
    });
    expect(decision.ordinarySlots).toBe(0);
    expect(decision.breakingSlots).toBeGreaterThan(0);

    const selected = allocateDailyCapacity(
      [
        { trendId: "minor", priorityScore: 61 },
        { trendId: "major", priorityScore: 93 },
      ],
      policy,
      decision,
    );
    expect(selected.map((item) => item.trendId)).toEqual(["major"]);
  });

  it("ranks by importance rather than by arrival order", () => {
    const selected = allocateDailyCapacity(
      [
        { trendId: "arrived-first", priorityScore: 58 },
        { trendId: "arrived-second", priorityScore: 72 },
        { trendId: "arrived-third", priorityScore: 88 },
      ],
      policy,
      { ordinarySlots: 1, breakingSlots: 0, stopReason: null },
    );
    expect(selected.map((item) => item.trendId)).toEqual(["arrived-third"]);
  });

  it("stops on cost before it stops on count", () => {
    const decision = decideDailyCapacity(policy, {
      startedToday: 1,
      spentUsd: 9.8,
    });
    expect(decision.stopReason).toBe("daily_cost_limit_reached");
    expect(decision.ordinarySlots + decision.breakingSlots).toBe(0);
  });

  it("stops once even major news has exhausted the hard ceiling", () => {
    const decision = decideDailyCapacity(policy, {
      startedToday: 8,
      spentUsd: 4.8,
    });
    expect(decision.stopReason).toBe("daily_story_limit_reached");

    expect(
      allocateDailyCapacity(
        [{ trendId: "major", priorityScore: 99 }],
        policy,
        decision,
      ),
    ).toHaveLength(0);
  });

  it("never plans more stories than the remaining balance can pay for", () => {
    const decision = decideDailyCapacity(
      { ...policy, dailyCostLimitUsd: 1.5 },
      fresh,
    );
    expect(decision.ordinarySlots + decision.breakingSlots).toBe(2);
  });
});
