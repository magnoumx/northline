import { JobStateError } from "./state-machine";

export const NEWSROOM_SCHEDULES = [
  {
    kind: "trend.refresh",
    queue: "northline-editorial",
    cadence: "15m",
    maximumFreshnessMs: 30 * 60_000,
    featureFlag: "FEATURE_TREND_CONNECTORS",
  },
  {
    kind: "intelligence.high_signal_sample",
    queue: "northline-editorial",
    cadence: "monthly",
    maximumFreshnessMs: 35 * 24 * 60 * 60_000,
    featureFlag: "FEATURE_SOURCE_ACQUISITION",
  },
  {
    kind: "opportunity.rescore",
    queue: "northline-editorial",
    cadence: "15m",
    maximumFreshnessMs: 30 * 60_000,
    featureFlag: "FEATURE_DURABLE_JOBS",
  },
  {
    kind: "article.autodraft",
    queue: "northline-editorial",
    cadence: "15m",
    maximumFreshnessMs: 30 * 60_000,
    featureFlag: "FEATURE_AUTONOMOUS_NEWSROOM",
  },
  {
    kind: "article.autopublish",
    queue: "northline-editorial",
    cadence: "15m",
    maximumFreshnessMs: 30 * 60_000,
    featureFlag: "FEATURE_AUTO_PUBLISH",
  },
  {
    kind: "internal_links.refresh",
    queue: "northline-editorial",
    cadence: "daily",
    maximumFreshnessMs: 36 * 60 * 60_000,
    featureFlag: "FEATURE_DURABLE_JOBS",
  },
  {
    kind: "article_audio.backfill",
    queue: "northline-editorial",
    cadence: "15m",
    maximumFreshnessMs: 30 * 60_000,
    featureFlag: "FEATURE_ARTICLE_AUDIO",
  },
  {
    kind: "newsletter.issue_send",
    queue: "northline-editorial",
    cadence: "daily",
    maximumFreshnessMs: 36 * 60 * 60_000,
    featureFlag: "FEATURE_NEWSLETTER_DELIVERY",
  },
  {
    kind: "archive.media_backfill",
    queue: "northline-editorial",
    cadence: "15m",
    maximumFreshnessMs: 30 * 60_000,
    featureFlag: "FEATURE_ARCHIVE_MEDIA_BACKFILL",
  },
  {
    kind: "article_audio.generate",
    queue: "northline-editorial",
    cadence: "event",
    maximumFreshnessMs: 24 * 60 * 60_000,
    featureFlag: "FEATURE_ARTICLE_AUDIO",
  },
  {
    kind: "maintenance.data_hygiene",
    queue: "northline-editorial",
    cadence: "daily",
    maximumFreshnessMs: 26 * 60 * 60_000,
    featureFlag: "FEATURE_DURABLE_JOBS",
  },
] as const;

export type NewsroomScheduleKind = (typeof NEWSROOM_SCHEDULES)[number]["kind"];

export function scheduledJobIdempotencyKey(
  kind: NewsroomScheduleKind,
  windowStart: Date,
): string {
  if (!Number.isFinite(windowStart.getTime())) {
    throw new TypeError("Schedule window must be a valid date.");
  }
  return `${kind}:${windowStart.toISOString()}`;
}

export function scheduleFreshness(
  kind: NewsroomScheduleKind,
  lastSuccessAt: Date | null,
  now = new Date(),
): "FRESH" | "STALE" | "NEVER_RAN" {
  const schedule = NEWSROOM_SCHEDULES.find((entry) => entry.kind === kind);
  if (!schedule) {
    throw new JobStateError("NOT_FOUND", "Schedule definition not found.");
  }
  if (!lastSuccessAt) return "NEVER_RAN";
  if (
    !Number.isFinite(lastSuccessAt.getTime()) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new TypeError("Freshness timestamps must be valid dates.");
  }
  return now.getTime() - lastSuccessAt.getTime() <=
    schedule.maximumFreshnessMs
    ? "FRESH"
    : "STALE";
}

export function enabledNewsroomSchedules(
  environment: Record<string, string | undefined> = process.env,
) {
  if (
    environment.FEATURE_DURABLE_JOBS !== "true" ||
    environment.FEATURE_SCHEDULED_INGESTION !== "true"
  ) {
    return [];
  }
  return NEWSROOM_SCHEDULES.filter(
    (schedule) => environment[schedule.featureFlag] === "true",
  );
}
