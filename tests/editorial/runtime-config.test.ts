import { describe, expect, it } from "vitest";
import {
  describeRuntimeConfig,
  resolveRuntimeConfig,
  RUNTIME_FLAGS,
  RUNTIME_SETTINGS,
} from "../../lib/editorial/runtime-config";

describe("runtime configuration", () => {
  it("resolves to the declared defaults when nothing is set", () => {
    const { settings, flags } = resolveRuntimeConfig({});
    expect(settings.storiesPerDay).toBe(RUNTIME_SETTINGS.storiesPerDay.default);
    expect(settings.dailyCostCeilingUsd).toBe(
      RUNTIME_SETTINGS.dailyCostCeilingUsd.default,
    );
    expect(flags.aiIllustrationFallback).toBe(
      RUNTIME_FLAGS.aiIllustrationFallback.default,
    );
  });

  it("accepts an operator override", () => {
    const { settings } = resolveRuntimeConfig({
      AUTONOMOUS_DRAFT_DAILY_LIMIT: "12",
      TTS_DAILY_BUDGET_USD: "5",
    });
    expect(settings.storiesPerDay).toBe(12);
    expect(settings.narrationDailyBudgetUsd).toBe(5);
  });

  it("clamps an out-of-range value instead of obeying it", () => {
    // A typo in a secret should not become an instruction to publish 900
    // stories or to spend nothing at all.
    const { settings } = resolveRuntimeConfig({
      AUTONOMOUS_DRAFT_DAILY_LIMIT: "900",
      AUTONOMOUS_DAILY_COST_LIMIT_USD: "0",
    });
    expect(settings.storiesPerDay).toBe(RUNTIME_SETTINGS.storiesPerDay.maximum);
    expect(settings.dailyCostCeilingUsd).toBe(
      RUNTIME_SETTINGS.dailyCostCeilingUsd.minimum,
    );
  });

  it("falls back to the default for a value that is not a number", () => {
    // This is the failure that took the newsroom down: a secret carrying a
    // stray newline must never silently become zero.
    for (const raw of ["", "  ", "true\n", "abc"]) {
      const { settings } = resolveRuntimeConfig({
        AUTONOMOUS_DRAFT_DAILY_LIMIT: raw,
      });
      expect(settings.storiesPerDay, JSON.stringify(raw)).toBe(
        RUNTIME_SETTINGS.storiesPerDay.default,
      );
    }
  });

  it("treats only an exact 'true' as on", () => {
    expect(
      resolveRuntimeConfig({ FEATURE_AI_ILLUSTRATION: "true" }).flags
        .aiIllustrationFallback,
    ).toBe(true);
    for (const raw of ["false", "TRUE", "1", "yes"]) {
      expect(
        resolveRuntimeConfig({ FEATURE_AI_ILLUSTRATION: raw }).flags
          .aiIllustrationFallback,
        raw,
      ).toBe(false);
    }
  });

  it("declares bounds that make sense", () => {
    for (const [name, setting] of Object.entries(RUNTIME_SETTINGS)) {
      expect(setting.minimum, name).toBeLessThanOrEqual(setting.maximum);
      expect(setting.default, name).toBeGreaterThanOrEqual(setting.minimum);
      expect(setting.default, name).toBeLessThanOrEqual(setting.maximum);
      // Every setting has to explain itself to an operator.
      expect(setting.describes.length, name).toBeGreaterThan(20);
    }
  });

  it("describes the live configuration for the dashboard and the docs", () => {
    const rows = describeRuntimeConfig({ AUTONOMOUS_DRAFT_DAILY_LIMIT: "12" });
    const overridden = rows.find(
      (row) => row.key === "AUTONOMOUS_DRAFT_DAILY_LIMIT",
    );
    expect(overridden?.value).toBe("12");
    expect(overridden?.isDefault).toBe(false);

    const untouched = rows.find((row) => row.key === "AUTO_PUBLISH_DAILY_LIMIT");
    expect(untouched?.isDefault).toBe(true);
    // The description an operator reads comes from the same declaration the
    // code obeys, so documentation cannot drift from behaviour.
    expect(untouched?.describes).toBe(
      RUNTIME_SETTINGS.publicationsPerDay.describes,
    );
  });
});

describe("the executors obey the declaration", () => {
  it("no longer re-declares a limit at its point of use", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const executors = readFileSync(
      fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
      "utf8",
    ).replace(/\s+/gu, " ");

    // Each of these had its own inline default beside the declaration's, which
    // is how the same limit came to be documented as one number and obeyed as
    // another.
    for (const key of [
      "AUTONOMOUS_DRAFT_DAILY_LIMIT",
      "AUTO_PUBLISH_DAILY_LIMIT",
      "ARTICLE_AUDIO_DAILY_ARTICLE_LIMIT",
      "AUTONOMOUS_BREAKING_RESERVE",
      "AUTONOMOUS_DAILY_COST_LIMIT_USD",
    ]) {
      expect(executors, key).not.toContain(`environment.${key}`);
    }
    expect(executors).toContain("resolveRuntimeConfig(environment)");
  });

  it("reads the corroboration threshold from the declaration", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const pipeline = readFileSync(
      fileURLToPath(
        new URL("../../lib/editorial/autonomous-newsroom.ts", import.meta.url),
      ),
      "utf8",
    ).replace(/\s+/gu, " ");
    expect(pipeline).toContain("settings.minimumIndependentSources");
    expect(pipeline).not.toContain("independentCount < 3");
  });
});
