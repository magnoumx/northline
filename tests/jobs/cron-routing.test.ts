import { describe, expect, it } from "vitest";
import {
  NEWSROOM_CRON_EXPRESSIONS,
  describeScheduleCadence,
  isKnownNewsroomCron,
  schedulesForCron,
} from "../../lib/jobs/cron-routing";
import { NEWSROOM_SCHEDULES } from "../../lib/jobs/schedules";

describe("newsroom cron routing", () => {
  it("maps every 15-minute cron to discovery, drafting, publishing, and audio jobs", () => {
    expect(schedulesForCron("*/15 * * * *")).toEqual([
      "trend.refresh",
      "opportunity.rescore",
      "article.autodraft",
      "article.autopublish",
      "article_audio.backfill",
      "archive.media_backfill",
    ]);
  });

  it("maps the daily cron to the internal-link refresh and the newsletter", () => {
    expect(schedulesForCron("0 0 * * *")).toEqual([
      "internal_links.refresh",
      "newsletter.issue_send",
      "maintenance.data_hygiene",
    ]);
  });

  it("maps the monthly cron to the high-signal sample collection", () => {
    expect(schedulesForCron("0 0 1 * *")).toEqual([
      "intelligence.high_signal_sample",
    ]);
  });

  it("rejects cron expressions that are not part of the schedule", () => {
    expect(() => schedulesForCron("0 12 * * *")).toThrow(TypeError);
    expect(isKnownNewsroomCron("0 12 * * *")).toBe(false);
    expect(isKnownNewsroomCron("*/15 * * * *")).toBe(true);
  });

  it("covers every non-event schedule with a cron cadence", () => {
    const cronSchedules = NEWSROOM_SCHEDULES.filter(
      (entry) => entry.cadence !== "event",
    );
    for (const entry of cronSchedules) {
      const cadence = describeScheduleCadence(entry.kind);
      expect(NEWSROOM_CRON_EXPRESSIONS).toContain(cadence);
      expect(schedulesForCron(cadence)).toContain(entry.kind);
    }
  });

  it("keeps event-driven schedules out of the cron map", () => {
    expect(describeScheduleCadence("article_audio.generate")).toBe("event");
  });
});