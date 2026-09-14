import { describe, expect, it } from "vitest";
import {
  blindCandidateId,
  createBlindBenchmarkManifest,
  weightedBlindScore,
} from "../../lib/ai";

describe("blind AI benchmark foundation", () => {
  it("creates exactly 50 provider-neutral tasks", () => {
    const manifest = createBlindBenchmarkManifest();
    expect(manifest).toHaveLength(50);
    expect(new Set(manifest.map((task) => task.id))).toHaveLength(50);
    expect(JSON.stringify(manifest)).not.toMatch(
      /openai|anthropic|google|gemini|claude|gpt/iu,
    );
  });

  it("creates stable blinded candidate aliases from a private run salt", async () => {
    const first = await blindCandidateId(
      "provider-a",
      "model-a",
      "benchmark_run_2026_07_24",
    );
    const second = await blindCandidateId(
      "provider-a",
      "model-a",
      "benchmark_run_2026_07_24",
    );
    expect(first).toBe(second);
    expect(first).toMatch(/^candidate-[A-Za-z0-9_-]{12}$/u);
  });

  it("weights factual and evidence fidelity most heavily", () => {
    expect(
      weightedBlindScore({
        factualAccuracy: 100,
        evidenceFidelity: 100,
        schemaCompliance: 80,
        uncertaintyCalibration: 80,
        editorialUsefulness: 80,
      }),
    ).toBe(92);
    expect(
      weightedBlindScore({
        factualAccuracy: 100,
        evidenceFidelity: 100,
        schemaCompliance: 100,
        uncertaintyCalibration: 100,
        editorialUsefulness: 100,
        hardFailure: true,
      }),
    ).toBe(0);
  });
});
