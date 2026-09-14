/**
 * The newsroom operating picture.
 *
 * The overview was a navigation page: links to other screens, and a few numbers
 * that came from fixtures. An operator opening it could not answer the only
 * questions that matter at a glance - is the newsroom running, is anything
 * stuck, and what has it spent.
 *
 * Every field here is a count of something that exists, or null. A subsystem
 * that has not been measured reports `unknown`, never `healthy`, because an
 * absence of logs is not evidence of health - that mistake is what let the
 * scheduled pipeline sit dead for two hours while every surface looked fine.
 */

export type SubsystemState = "healthy" | "degraded" | "failing" | "unknown";

export type SubsystemHealth = {
  name: string;
  state: SubsystemState;
  /** What the state is based on, in the operator's words. */
  evidence: string;
};

export type CockpitQueue = {
  label: string;
  count: number;
  /** Why these are waiting, so the number is actionable. */
  meaning: string;
};

export type CockpitAlert = {
  severity: "critical" | "warning";
  message: string;
};

export type Cockpit = {
  today: {
    discovered: number;
    drafted: number;
    published: number;
    heldForReview: number;
    spentUsd: number;
    ceilingUsd: number | null;
  };
  health: SubsystemHealth[];
  queues: CockpitQueue[];
  alerts: CockpitAlert[];
};

export type CockpitInput = {
  trendsDiscovered: number;
  storyRunsStarted: number;
  publishedToday: number;
  heldForReview: number;
  approvedWaiting: number;
  audioPending: number;
  audioFailed: number;
  articlesWithoutLicensedHero: number;
  spentMicros: number;
  ceilingUsd: number | null;
  /** Minutes since the last completed scheduled job, or null if none ever ran. */
  minutesSinceLastJob: number | null;
  /** Distinct job types that failed in the recent window. */
  failingJobTypes: string[];
  confirmedSubscribers: number;
  newsletterEverSent: boolean;
};

/**
 * Health from evidence.
 *
 * The scheduler is the one subsystem whose silence is itself a symptom: cron
 * reported success while the handler returned immediately, so "no recent job"
 * has to read as failing rather than idle.
 */
function schedulerHealth(input: CockpitInput): SubsystemHealth {
  if (input.minutesSinceLastJob === null) {
    return {
      name: "Scheduler",
      state: "unknown",
      evidence: "No scheduled job has ever completed.",
    };
  }
  if (input.minutesSinceLastJob > 45) {
    return {
      name: "Scheduler",
      state: "failing",
      evidence: `Last completed job was ${Math.round(input.minutesSinceLastJob)} minutes ago; the cadence is 15 minutes.`,
    };
  }
  if (input.minutesSinceLastJob > 20) {
    return {
      name: "Scheduler",
      state: "degraded",
      evidence: `Last completed job was ${Math.round(input.minutesSinceLastJob)} minutes ago.`,
    };
  }
  return {
    name: "Scheduler",
    state: "healthy",
    evidence: `Last completed job ${Math.round(input.minutesSinceLastJob)} minutes ago.`,
  };
}

export function buildCockpit(input: CockpitInput): Cockpit {
  const spentUsd = Math.round((input.spentMicros / 1_000_000) * 100) / 100;

  const health: SubsystemHealth[] = [
    schedulerHealth(input),
    {
      name: "Jobs",
      state: input.failingJobTypes.length > 0 ? "degraded" : "healthy",
      evidence:
        input.failingJobTypes.length > 0
          ? `Failing: ${input.failingJobTypes.join(", ")}.`
          : "No job type is failing in the recent window.",
    },
    {
      name: "Narration",
      state:
        input.audioFailed > 0
          ? "degraded"
          : input.audioPending > 0
            ? "healthy"
            : "healthy",
      evidence: `${input.audioPending} pending, ${input.audioFailed} failed.`,
    },
    {
      name: "Newsletter",
      state: input.newsletterEverSent
        ? "healthy"
        : input.confirmedSubscribers > 0
          ? "degraded"
          : "unknown",
      evidence: input.newsletterEverSent
        ? `${input.confirmedSubscribers} confirmed subscribers.`
        : input.confirmedSubscribers > 0
          ? `${input.confirmedSubscribers} confirmed subscribers and no issue sent yet.`
          : "No confirmed subscribers yet.",
    },
  ];

  const queues: CockpitQueue[] = [
    {
      label: "Held for human review",
      count: input.heldForReview,
      meaning: "The publication gate refused these; a person has to decide.",
    },
    {
      label: "Approved, awaiting release",
      count: input.approvedWaiting,
      meaning: "Cleared the gate and will publish on the next cycle.",
    },
    {
      label: "Narration pending",
      count: input.audioPending,
      meaning: "Queued for AI narration.",
    },
    {
      label: "Published without licensed imagery",
      count: input.articlesWithoutLicensedHero,
      meaning: "Carrying the house graphic rather than a photograph.",
    },
  ];

  const alerts: CockpitAlert[] = [];
  const scheduler = health[0];
  if (scheduler.state === "failing") {
    alerts.push({ severity: "critical", message: scheduler.evidence });
  }
  if (input.failingJobTypes.length > 0) {
    alerts.push({
      severity: "warning",
      message: `Job failures: ${input.failingJobTypes.join(", ")}.`,
    });
  }
  if (input.ceilingUsd !== null && spentUsd >= input.ceilingUsd * 0.9) {
    alerts.push({
      severity: "warning",
      message: `Spend is ${spentUsd} of a ${input.ceilingUsd} ceiling.`,
    });
  }
  if (input.audioFailed > 0) {
    alerts.push({
      severity: "warning",
      message: `${input.audioFailed} narrations failed and will not retry on their own.`,
    });
  }

  return {
    today: {
      discovered: input.trendsDiscovered,
      drafted: input.storyRunsStarted,
      published: input.publishedToday,
      heldForReview: input.heldForReview,
      spentUsd,
      ceilingUsd: input.ceilingUsd,
    },
    health,
    queues,
    alerts,
  };
}
