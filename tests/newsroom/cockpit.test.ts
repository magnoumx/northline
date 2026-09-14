import { describe, expect, it } from "vitest";
import { buildCockpit, type CockpitInput } from "../../lib/newsroom/cockpit";

const healthy: CockpitInput = {
  trendsDiscovered: 40,
  storyRunsStarted: 6,
  publishedToday: 4,
  heldForReview: 25,
  approvedWaiting: 3,
  audioPending: 13,
  audioFailed: 0,
  articlesWithoutLicensedHero: 14,
  spentMicros: 1_450_000,
  ceilingUsd: 10,
  minutesSinceLastJob: 4,
  failingJobTypes: [],
  confirmedSubscribers: 0,
  newsletterEverSent: false,
};

const stateOf = (input: CockpitInput, name: string) =>
  buildCockpit(input).health.find((entry) => entry.name === name)?.state;

describe("scheduler health", () => {
  it("is healthy when a job completed inside the cadence", () => {
    expect(stateOf(healthy, "Scheduler")).toBe("healthy");
  });

  it("is failing when nothing has run for far longer than the cadence", () => {
    // The pipeline once sat dead for two hours while cron reported Success on
    // every invocation, because the handler returned at its first guard.
    expect(
      stateOf({ ...healthy, minutesSinceLastJob: 120 }, "Scheduler"),
    ).toBe("failing");
  });

  it("is degraded before it is failing", () => {
    expect(stateOf({ ...healthy, minutesSinceLastJob: 30 }, "Scheduler")).toBe(
      "degraded",
    );
  });

  it("reports unknown, never healthy, when nothing has ever run", () => {
    // An absence of logs is not evidence of health.
    expect(
      stateOf({ ...healthy, minutesSinceLastJob: null }, "Scheduler"),
    ).toBe("unknown");
  });

  it("says what the state is based on", () => {
    const scheduler = buildCockpit({
      ...healthy,
      minutesSinceLastJob: 120,
    }).health[0];
    expect(scheduler.evidence).toContain("120 minutes ago");
    expect(scheduler.evidence).toContain("cadence is 15 minutes");
  });
});

describe("newsletter health", () => {
  it("is unknown with no subscribers rather than healthy", () => {
    expect(stateOf(healthy, "Newsletter")).toBe("unknown");
  });

  it("is degraded when people subscribed and nothing was ever sent", () => {
    // Subscribers waiting on an issue that never comes is a real fault.
    expect(
      stateOf({ ...healthy, confirmedSubscribers: 12 }, "Newsletter"),
    ).toBe("degraded");
  });

  it("is healthy once an issue has actually gone out", () => {
    expect(
      stateOf(
        { ...healthy, confirmedSubscribers: 12, newsletterEverSent: true },
        "Newsletter",
      ),
    ).toBe("healthy");
  });
});

describe("alerts", () => {
  it("stays quiet when nothing is wrong", () => {
    expect(buildCockpit(healthy).alerts).toEqual([]);
  });

  it("raises a critical alert when the scheduler is dead", () => {
    const alerts = buildCockpit({ ...healthy, minutesSinceLastJob: 120 }).alerts;
    expect(alerts[0].severity).toBe("critical");
  });

  it("warns before the spend ceiling is reached, not after", () => {
    const alerts = buildCockpit({ ...healthy, spentMicros: 9_200_000 }).alerts;
    expect(alerts.some((alert) => alert.message.includes("ceiling"))).toBe(true);
  });

  it("warns that failed narrations will not retry themselves", () => {
    const alerts = buildCockpit({ ...healthy, audioFailed: 12 }).alerts;
    expect(
      alerts.some((alert) => alert.message.includes("will not retry")),
    ).toBe(true);
  });
});

describe("queues explain themselves", () => {
  it("says why each number is waiting", () => {
    for (const queue of buildCockpit(healthy).queues) {
      expect(queue.meaning.length, queue.label).toBeGreaterThan(20);
    }
  });

  it("reports spend in dollars", () => {
    expect(buildCockpit(healthy).today.spentUsd).toBe(1.45);
  });
});
