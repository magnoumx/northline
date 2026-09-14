import { describe, expect, it, vi } from "vitest";
import {
  prepareAiReviewPackage,
  type AiWorkflowLedger,
} from "../../lib/editorial/ai-workflow";
import type { AiTaskMetadata } from "../../lib/ai";

const sourcePacket = [
  {
    id: "evidence_primary_1",
    sourceId: "source_primary_1",
    sourceName: "Official release",
    sourceType: "PRIMARY" as const,
    summary: "The release states the effective date and scope.",
    excerptHash: "abcdefghijklmnopqrstuvwxyzABCDE1234567890_-",
    observedAt: "2026-07-24T12:00:00.000Z",
  },
  {
    id: "evidence_independent_1",
    sourceId: "source_independent_1",
    sourceName: "Independent coverage",
    sourceType: "INDEPENDENT" as const,
    summary: "Independent reporting supplies context without contradiction.",
    excerptHash: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcde1234567890_-",
    observedAt: "2026-07-24T12:05:00.000Z",
  },
];

describe("AI editorial workflow separation", () => {
  it("builds a review package without giving a model approval or publication authority", async () => {
    const events: Parameters<AiWorkflowLedger["record"]>[0][] = [];
    const draftData = {
      headline: "Agency publishes a verified technology update",
      subheadline: "The primary release confirms the effective date.",
      sections: [
        {
          heading: "What changed",
          paragraphs: ["The update begins on the date in the release."],
          claimIdsUsed: ["claim_central_1"],
        },
      ],
      unknownsDisclosed: [],
    };
    const factReview = vi.fn(async (input: { excludeProviders?: readonly string[] }) => ({
      data: { findings: [], blocking: false },
      metadata: metadata("anthropic"),
      input,
    }));
    const operations = {
      async normalizeEntities() {
        return {
          data: { entities: [{ name: "Agency", type: "organization" as const, aliases: [] }] },
          metadata: metadata("google"),
        };
      },
      async extractClaims() {
        return {
          data: {
            claims: [
              {
                id: "claim_central_1",
                text: "The update begins on the date in the release.",
                importance: "central" as const,
                evidenceIds: ["evidence_primary_1"],
                status: "supported" as const,
              },
            ],
            explicitUnknowns: ["Long-term implementation effects are unknown."],
          },
          metadata: metadata("openai"),
        };
      },
      async compareEvidence() {
        return {
          data: {
            findings: [
              {
                claimId: "claim_central_1",
                disposition: "supported" as const,
                supportingEvidenceIds: ["evidence_primary_1"],
                contradictingEvidenceIds: [],
                explanation: "The primary release directly supports the claim.",
              },
            ],
          },
          metadata: metadata("openai"),
        };
      },
      async planArticle() {
        return {
          data: {
            headlineDirection: "Agency publishes verified update",
            readerPromise: "Explain the confirmed change and open questions.",
            sections: [
              {
                heading: "What changed",
                claimIds: ["claim_central_1"],
                purpose: "Explain the verified announcement.",
              },
            ],
            explicitUnknowns: [],
          },
          metadata: metadata("openai"),
        };
      },
      async draftArticle() {
        return {
          data: draftData,
          metadata: metadata("openai"),
        };
      },
      reviewFacts: factReview,
      async copyEdit() {
        return {
          data: {
            draft: draftData,
            factualPacketPreserved: true,
            attemptedFactualAdditions: [],
          },
          metadata: metadata("anthropic"),
        };
      },
      async generateSeoBrief() {
        return {
          data: {
            primaryReaderIntent: "Understand the verified agency update.",
            primaryQuery: "agency technology update",
            secondaryQueries: [],
            entities: ["Agency"],
            questions: [],
            missingReaderValue: [],
            recommendedFormat: "standard news",
            internalLinks: [],
            recommendedMedia: [],
            freshnessPlan: "Update when the agency publishes implementation details.",
            updateTriggers: ["New agency implementation notice"],
            demandEstimate: "unknown" as const,
          },
          metadata: metadata("openai"),
        };
      },
      async generateHeadlineCandidates() {
        return {
          data: {
            candidates: [1, 2, 3].map((number) => ({
              headline: `Agency publishes verified technology update ${number}`,
              rationale: "Accurately reflects the central verified claim.",
              claimIds: ["claim_central_1"],
            })),
          },
          metadata: metadata("openai"),
        };
      },
    };

    const result = await prepareAiReviewPackage({
      workflowId: "workflow_ai_001",
      sourcePacket,
      operations,
      ledger: { async record(event) { events.push(event); } },
      budget: {
        maxInputTokens: 20_000,
        maxOutputTokens: 5_000,
        maxCostUsd: 2,
      },
    });

    expect(result.state).toBe("HUMAN_REVIEW_REQUIRED");
    expect(result.publishableByModel).toBe(false);
    expect(factReview).toHaveBeenCalledWith(
      expect.objectContaining({ excludeProviders: ["openai"] }),
    );
    expect(events.at(-1)).toMatchObject({
      stage: "HUMAN_REVIEW_REQUIRED",
      disposition: "COMPLETED",
    });
    expect(events.some((event) => event.stage === "PUBLISHED")).toBe(false);
  });
});

function metadata(provider: "openai" | "anthropic" | "google"): AiTaskMetadata {
  return {
    provider,
    model: `${provider}-configured-model`,
    promptId: "test",
    promptVersion: "test",
    policyVersion: "test-human-publish",
    promptHash: "abcdefghijklmnopqrstuvwxyzABCDE1234567890_-",
    inputContentHash: "abcdefghijklmnopqrstuvwxyzABCDE1234567890_-",
    startedAt: "2026-07-24T12:00:00.000Z",
    endedAt: "2026-07-24T12:00:01.000Z",
    usage: { inputTokens: 100, outputTokens: 50 },
    costUsd: 0.01,
    retryCount: 0,
    structuredOutputValid: true,
    evidenceIds: [],
    resultDisposition: "COMPLETED",
    attemptedProviders: [provider],
    groundedSourceUrls: [],
    groundingSearchQueries: [],
  };
}
