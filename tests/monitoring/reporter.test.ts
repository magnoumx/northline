import { describe, expect, it } from "vitest";
import {
  createMonitoringReporter,
  parseSentryDsn,
  type SentryEnvelope,
} from "../../lib/monitoring/reporter";

const DSN = "https://0123456789abcdef0123456789abcdef@o123.ingest.sentry.io/4567890";

describe("monitoring reporter", () => {
  it("parses a valid Sentry DSN", () => {
    const parsed = parseSentryDsn(DSN);
    expect(parsed).not.toBeNull();
    expect(parsed!.publicKey).toBe("0123456789abcdef0123456789abcdef");
    expect(parsed!.endpoint).toBe("https://o123.ingest.sentry.io/api/4567890/envelope/");
  });

  it("rejects malformed DSNs", () => {
    expect(parseSentryDsn("not-a-dsn")).toBeNull();
    expect(parseSentryDsn("http://insecure@host/1")).toBeNull();
    expect(parseSentryDsn("")).toBeNull();
  });

  it("is disabled and a no-op without a DSN", async () => {
    const reporter = createMonitoringReporter({ dsn: null });
    expect(reporter.enabled).toBe(false);
    await expect(reporter.captureError(new Error("boom"))).resolves.toBeUndefined();
  });

  it("captures errors with a normalized exception through the transport", async () => {
    const sent: SentryEnvelope[] = [];
    const reporter = createMonitoringReporter({
      dsn: DSN,
      environment: "preview",
      release: "v5-test",
      transport: async (envelope) => {
        sent.push(envelope);
      },
    });
    expect(reporter.enabled).toBe(true);
    await reporter.captureError(new Error("database down"), { route: "/api/health" });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("exception");
    expect(sent[0].level).toBe("error");
    expect(sent[0].exception?.message).toBe("database down");
    expect(sent[0].environment).toBe("preview");
    expect(sent[0].release).toBe("v5-test");
    expect(sent[0].context).toEqual({ route: "/api/health" });
  });

  it("captures messages with an explicit level", async () => {
    const sent: SentryEnvelope[] = [];
    const reporter = createMonitoringReporter({
      dsn: DSN,
      transport: async (envelope) => { sent.push(envelope); },
    });
    await reporter.captureMessage("Queue backlog rising", "warning");
    expect(sent[0].type).toBe("message");
    expect(sent[0].level).toBe("warning");
    expect(sent[0].message).toBe("Queue backlog rising");
  });

  it("normalizes non-Error thrown values", async () => {
    const sent: SentryEnvelope[] = [];
    const reporter = createMonitoringReporter({
      dsn: DSN,
      transport: async (envelope) => { sent.push(envelope); },
    });
    await reporter.captureError("string failure");
    expect(sent[0].exception?.message).toBe("string failure");
  });

  it("never throws when the transport fails", async () => {
    const reporter = createMonitoringReporter({
      dsn: DSN,
      transport: async () => {
        throw new Error("sentry unreachable");
      },
    });
    await expect(reporter.captureError(new Error("x"))).resolves.toBeUndefined();
  });
});
