import { type NewsroomScheduleKind } from "./schedules";

export const NEWSROOM_CRON_EXPRESSIONS = [
  "*/15 * * * *",
  "0 0 * * *",
  "0 0 1 * *",
] as const;

export type NewsroomCronExpression = (typeof NEWSROOM_CRON_EXPRESSIONS)[number];

const CRON_TO_SCHEDULES: ReadonlyMap<NewsroomCronExpression, readonly NewsroomScheduleKind[]> =
  new Map([
    ["*/15 * * * *", ["trend.refresh", "opportunity.rescore", "article.autodraft", "article.autopublish", "article_audio.backfill", "archive.media_backfill"]],
    ["0 0 * * *", ["internal_links.refresh", "newsletter.issue_send", "maintenance.data_hygiene"]],
    ["0 0 1 * *", ["intelligence.high_signal_sample"]],
  ]);

export function schedulesForCron(
  cron: string,
): readonly NewsroomScheduleKind[] {
  const schedules = CRON_TO_SCHEDULES.get(
    cron as NewsroomCronExpression,
  );
  if (!schedules) {
    throw new TypeError(`Unknown newsroom cron expression: ${cron}`);
  }
  return schedules;
}

export function isKnownNewsroomCron(cron: string): boolean {
  return CRON_TO_SCHEDULES.has(cron as NewsroomCronExpression);
}

export function describeScheduleCadence(
  kind: NewsroomScheduleKind,
): NewsroomCronExpression | "event" {
  switch (kind) {
    case "trend.refresh":
    case "opportunity.rescore":
    case "article.autodraft":
    case "article.autopublish":
    case "article_audio.backfill":
    case "archive.media_backfill":
      return "*/15 * * * *";
    case "internal_links.refresh":
    case "newsletter.issue_send":
    case "maintenance.data_hygiene":
      return "0 0 * * *";
    case "intelligence.high_signal_sample":
      return "0 0 1 * *";
    case "article_audio.generate":
      return "event";
  }
}
