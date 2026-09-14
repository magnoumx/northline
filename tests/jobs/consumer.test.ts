import { describe, expect, it } from "vitest";
import {
  digestError,
  dispatchQueueMessage,
  isKnownScheduleKind,
  type JobHandlerRegistry,
} from "../../lib/jobs/consumer";
import { createDefaultJobRegistry } from "../../lib/jobs/handlers";

describe("queue message dispatcher", () => {
  it("dead-letters malformed messages without a kind", async () => {
    const result = await dispatchQueueMessage({
      message: { noKind: true },
      registry: {},
      attemptCount: 1,
    });
    expect(result.disposition).toBe("DEAD_LETTER");
    expect(result.reason).toBe("malformed_message");
  });

  it("dead-letters messages with an unknown schedule kind", async () => {
    const result = await dispatchQueueMessage({
      message: { kind: "not.a.real.kind" },
      registry: {},
      attemptCount: 1,
    });
    expect(result.disposition).toBe("DEAD_LETTER");
    expect(result.reason).toBe("unknown_kind");
  });

  it("acks known kinds that have no registered handler yet", async () => {
    const result = await dispatchQueueMessage({
      message: { kind: "trend.refresh" },
      registry: {},
      attemptCount: 1,
    });
    expect(result.disposition).toBe("ACK");
    expect(result.reason).toBe("no_handler_registered");
  });

  it("acks when a handler completes", async () => {
    const ran: string[] = [];
    const registry: JobHandlerRegistry = {
      "trend.refresh": async () => {
        ran.push("trend");
        return { outcome: "DONE" };
      },
    };
    const result = await dispatchQueueMessage({
      message: { kind: "trend.refresh", scheduledTime: "2026-07-24T00:00:00Z" },
      registry,
      attemptCount: 1,
    });
    expect(result.disposition).toBe("ACK");
    expect(result.reason).toBe("completed");
    expect(ran).toEqual(["trend"]);
  });

  it("retries on handler error until attempts are exhausted", async () => {
    const registry: JobHandlerRegistry = {
      "opportunity.rescore": async () => {
        throw new Error("transient outage");
      },
    };
    const retrying = await dispatchQueueMessage({
      message: { kind: "opportunity.rescore" },
      registry,
      attemptCount: 1,
      maximumAttempts: 3,
    });
    expect(retrying.disposition).toBe("RETRY");

    const dead = await dispatchQueueMessage({
      message: { kind: "opportunity.rescore" },
      registry,
      attemptCount: 3,
      maximumAttempts: 3,
    });
    expect(dead.disposition).toBe("DEAD_LETTER");
    expect(dead.errorDigest).toContain("transient outage");
  });

  it("default registry skips gracefully when feature flags are off", async () => {
    const registry = createDefaultJobRegistry();
    const result = await dispatchQueueMessage({
      message: { kind: "trend.refresh" },
      registry,
      services: { featureFlags: { FEATURE_TREND_CONNECTORS: "false" } },
      attemptCount: 1,
    });
    expect(result.disposition).toBe("ACK");
    expect(result.reason).toBe("trend.refresh:feature_off");
  });

  it("default registry keeps internal-link refresh behind its feature flag", async () => {
    const registry = createDefaultJobRegistry();
    const result = await dispatchQueueMessage({
      message: { kind: "internal_links.refresh" },
      registry,
      services: { featureFlags: { FEATURE_INTERNAL_LINKS: "false" } },
      attemptCount: 1,
    });
    expect(result.disposition).toBe("ACK");
    expect(result.reason).toBe("internal_links.refresh:feature_off");
  });

  it("digests errors to a bounded string", () => {
    expect(digestError(new Error("boom"))).toBe("Error:boom");
    expect(digestError("plain")).toBe("plain");
    const long = "x".repeat(500);
    expect(digestError(long).length).toBe(200);
  });

  it("recognizes every schedule kind", () => {
    expect(isKnownScheduleKind("trend.refresh")).toBe(true);
    expect(isKnownScheduleKind("article_audio.generate")).toBe(true);
    expect(isKnownScheduleKind("article.autopublish")).toBe(true);
    expect(isKnownScheduleKind("random")).toBe(false);
  });
});
