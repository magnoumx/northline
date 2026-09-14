import { describe, expect, it } from "vitest";
import {
  enabledNewsroomSchedules,
  scheduledJobIdempotencyKey,
  scheduleFreshness,
} from "../../lib/jobs";

describe("V4 newsroom schedules", () => {
  it("remains disabled until both durable jobs and scheduling are enabled", () => {
    expect(
      enabledNewsroomSchedules({
        FEATURE_DURABLE_JOBS: "true",
        FEATURE_SCHEDULED_INGESTION: "false",
        FEATURE_TREND_CONNECTORS: "true",
      }),
    ).toEqual([]);
  });

  it("selects only schedules whose capability is enabled", () => {
    expect(
      enabledNewsroomSchedules({
        FEATURE_DURABLE_JOBS: "true",
        FEATURE_SCHEDULED_INGESTION: "true",
        FEATURE_TREND_CONNECTORS: "true",
        FEATURE_SOURCE_ACQUISITION: "false",
      }).map((schedule) => schedule.kind),
    ).toContain("trend.refresh");
    expect(
      enabledNewsroomSchedules({
        FEATURE_DURABLE_JOBS: "true",
        FEATURE_SCHEDULED_INGESTION: "true",
        FEATURE_AUTO_PUBLISH: "true",
      }).map((schedule) => schedule.kind),
    ).toContain("article.autopublish");
  });

  it("creates deterministic schedule-window idempotency keys", () => {
    expect(
      scheduledJobIdempotencyKey(
        "trend.refresh",
        new Date("2026-07-24T12:00:00.000Z"),
      ),
    ).toBe("trend.refresh:2026-07-24T12:00:00.000Z");
  });

  it("reports never-run, fresh, and stale schedule states", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");
    expect(scheduleFreshness("trend.refresh", null, now)).toBe("NEVER_RAN");
    expect(
      scheduleFreshness(
        "trend.refresh",
        new Date("2026-07-24T11:45:00.000Z"),
        now,
      ),
    ).toBe("FRESH");
    expect(
      scheduleFreshness(
        "trend.refresh",
        new Date("2026-07-24T10:00:00.000Z"),
        now,
      ),
    ).toBe("STALE");
  });
});
