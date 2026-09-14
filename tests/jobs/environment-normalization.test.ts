import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const executors = readFileSync(
  fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
  "utf8",
);
const worker = readFileSync(
  fileURLToPath(new URL("../../worker/index.ts", import.meta.url)),
  "utf8",
);

describe("feature flag normalization", () => {
  it("trims environment values before any comparison", () => {
    // The outage: a secret set through a shell that appends a newline arrived
    // as "true\n", so `!== "true"` disabled the scheduled pipeline while cron
    // still reported Success on every invocation.
    expect(executors).toContain('typeof item === "string" ? item.trim() : undefined');
  });

  it("guards the scheduled handler on a trimmed value", () => {
    const scheduledGuard =
      /stringBinding\(bindings\.FEATURE_SCHEDULED_INGESTION\) !== "true"/u;
    const durableGuard =
      /stringBinding\(bindings\.FEATURE_DURABLE_JOBS\) !== "true"/u;

    expect(worker).toMatch(scheduledGuard);
    expect(worker).toMatch(durableGuard);
    // The raw comparisons must be gone, not merely supplemented.
    expect(worker).not.toMatch(/bindings\.FEATURE_SCHEDULED_INGESTION !== "true"/u);
    expect(worker).not.toMatch(/bindings\.FEATURE_DURABLE_JOBS !== "true"/u);
  });
});
