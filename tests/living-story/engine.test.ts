import { describe, expect, it } from "vitest";
import {
  classifyMeaningfulChange,
  claimDedupKey,
  computeNextCheck,
  evaluateSignal,
  signalsContradict,
  type ArticleVersionSnapshot,
  type StorySignal,
} from "../../lib/living-story/engine";

function version(overrides: Partial<ArticleVersionSnapshot> = {}): ArticleVersionSnapshot {
  return {
    articleId: "art_1",
    versionId: "v_1",
    headline: "Grid hearing concludes",
    evidence: [
      {
        claim: "The commission voted 3-2 to advance the proposal.",
        subject: "commission",
        metric: "vote",
        value: "3-2",
        sourceUrl: "https://official.example/hearing",
        recordedAt: "2026-07-24T10:00:00Z",
      },
    ],
    sensitive: false,
    ...overrides,
  };
}

function signal(overrides: Partial<StorySignal> = {}): StorySignal {
  return {
    id: "sig_" + Math.random().toString(36).slice(2),
    sourceUrl: "https://wire.example/a",
    sourceTier: 1,
    claim: "Default claim text",
    detectedAt: "2026-07-24T12:00:00Z",
    ...overrides,
  };
}

describe("living story signal evaluation", () => {
  it("reports no change when every incoming claim is already stored", () => {
    const proposal = evaluateSignal({
      incoming: [signal({ claim: "The commission voted 3-2 to advance the proposal." })],
      version: version(),
    });
    expect(proposal.disposition).toBe("NO_CHANGE");
    expect(proposal.state).toBe("NO_CHANGE");
    expect(proposal.newClaims).toHaveLength(0);
    expect(proposal.duplicateClaims).toHaveLength(1);
  });

  it("proposes an update for incremental new claims", () => {
    const proposal = evaluateSignal({
      incoming: [
        signal({ claim: "The governor signed the measure into law.", subject: "governor" }),
      ],
      version: version(),
    });
    expect(proposal.disposition).toBe("UPDATE_PROPOSED");
    expect(proposal.newClaims).toHaveLength(1);
    expect(proposal.primarySource?.sourceUrl).toBe("https://wire.example/a");
    expect(proposal.diff.afterClaimCount).toBe(2);
  });

  it("requires human review when a new claim contradicts stored evidence", () => {
    const proposal = evaluateSignal({
      incoming: [
        signal({
          claim: "The commission voted 4-1 to advance the proposal.",
          subject: "commission",
          metric: "vote",
          value: "4-1",
        }),
      ],
      version: version(),
    });
    expect(proposal.disposition).toBe("HUMAN_REVIEW_REQUIRED");
    expect(proposal.contradictions).toHaveLength(1);
    expect(proposal.requiresHumanReview).toBe(true);
  });

  it("requires human review when content is sensitive", () => {
    const proposal = evaluateSignal({
      incoming: [signal({ claim: "Casualties reported at the scene.", sensitive: true })],
      version: version(),
    });
    expect(proposal.disposition).toBe("HUMAN_REVIEW_REQUIRED");
    expect(proposal.sensitivityFlagged).toBe(true);
  });

  it("routes to media review when new media accompanies new claims", () => {
    const proposal = evaluateSignal({
      incoming: [
        signal({
          claim: "New satellite imagery published.",
          mediaUrls: ["https://cdn.example/img1.jpg"],
        }),
      ],
      version: version(),
    });
    expect(proposal.disposition).toBe("MEDIA_REVIEW");
    expect(proposal.mediaToReview).toEqual(["https://cdn.example/img1.jpg"]);
  });

  it("recommends a new angle when many novel subjects arrive", () => {
    const proposal = evaluateSignal({
      incoming: [
        signal({ claim: "Utility withdraws opposition.", subject: "utility" }),
        signal({ claim: "Union endorses measure.", subject: "union" }),
        signal({ claim: "Mayor issues statement.", subject: "mayor" }),
      ],
      version: version(),
    });
    expect(proposal.disposition).toBe("NEW_ANGLE_RECOMMENDED");
  });
});

describe("living story helpers", () => {
  it("normalizes claim dedup keys", () => {
    expect(claimDedupKey("  The   Vote  ")).toBe("the vote");
  });

  it("detects contradictions only on same subject+metric with differing values", () => {
    expect(
      signalsContradict(
        { subject: "x", metric: "count", value: "5" },
        { subject: "x", metric: "count", value: "6" },
      ),
    ).toBe(true);
    expect(
      signalsContradict(
        { subject: "x", metric: "count", value: "5" },
        { subject: "y", metric: "count", value: "6" },
      ),
    ).toBe(false);
  });

  it("computes cadence: 10-minute checks in the first 6 hours", () => {
    const published = new Date("2026-07-24T00:00:00Z");
    const now = new Date("2026-07-24T01:00:00Z");
    const next = computeNextCheck({ publishedAt: published, now });
    expect(next).not.toBeNull();
    expect(next!.getTime() - now.getTime()).toBe(10 * 60_000);
  });

  it("returns null after 30 days (signal-triggered only)", () => {
    const published = new Date("2026-06-01T00:00:00Z");
    const now = new Date("2026-07-24T00:00:00Z");
    expect(computeNextCheck({ publishedAt: published, now })).toBeNull();
  });

  it("classifies meaningful change for dateModified/audio/follower signals", () => {
    const material = classifyMeaningfulChange(
      evaluateSignal({
        incoming: [signal({ claim: "A genuinely new fact." })],
        version: version(),
      }),
    );
    expect(material.updateDateModified).toBe(true);
    expect(material.regenerateAudio).toBe(true);
    expect(material.notifyFollowers).toBe(true);
    expect(material.regenerateSocialCards).toBe(false);
  });
});
