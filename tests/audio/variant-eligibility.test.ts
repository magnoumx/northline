import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const executors = readFileSync(
  fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
  "utf8",
);

describe("article audio variant eligibility", () => {
  it("selects articles missing any configured variant, not just any narration", () => {
    // The regression: a NOT EXISTS across the whole variant list meant an
    // article with a READY Quick Brief was never selected again, so its Full
    // Article narration was never generated and that tab played the browser
    // voice instead of the AI voice.
    expect(executors).not.toMatch(
      /NOT EXISTS \(\s*SELECT 1 FROM article_audio_versions av/u,
    );
    expect(executors).toContain("COUNT(DISTINCT av.variant)");
    expect(executors).toContain("< ${audioVariants.length}");
  });

  it("still ignores variants that are already in flight", () => {
    expect(executors).toContain(
      "av.state IN ('QUEUED','GENERATING','PROCESSING','READY')",
    );
  });
});
