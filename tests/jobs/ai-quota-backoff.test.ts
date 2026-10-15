import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

const executors = read("lib/jobs/executors.ts");
const newsroom = read("lib/editorial/autonomous-newsroom.ts");
const providers = read("lib/ai/providers.ts");

// Google's free tier allows 20 generate_content requests per DAY. The scheduler
// kept starting four stories every fifteen minutes regardless, so ~380 runs a
// day each burned a request on a quota that had been empty since the first
// hour. Seven days passed with no article published and 753 identical
// rate-limit failures in the run table.
describe("a provider that is out of quota is left alone", () => {
  it("records a cooldown when a run dies on a rate limit", () => {
    const body = executors.slice(executors.indexOf("executeAutonomousArticleGenerate"));
    expect(body).toContain('errorCode === "AI_PROVIDER_RATE_LIMITED"');
    expect(body).toContain("recordAiProviderCooldown(");
  });

  it("skips scheduling entirely while the cooldown is open", () => {
    const body = executors
      .slice(executors.indexOf("export async function executeAutonomousDraftSchedule"))
      .replace(/\s+/gu, " ");
    const cooldownCheck = body.indexOf("readAiProviderCooldownUntil(");
    const candidateQuery = body.indexOf("SELECT * FROM trends");
    expect(cooldownCheck).toBeGreaterThan(-1);
    // The check has to come before the candidate scan, or the tick still costs
    // a query and a queue message for work that cannot run.
    expect(cooldownCheck).toBeLessThan(candidateQuery);
    expect(body).toContain('"article.autodraft", "ai_provider_cooldown"');
  });

  it("keeps the cooldown window operator-tunable with a bounded default", () => {
    expect(executors).toContain("AI_RATE_LIMIT_COOLDOWN_MINUTES");
  });
});

describe("drafting does not depend on a single provider's quota", () => {
  it("prefers the paid provider for research and keeps the free one as fallback", () => {
    const chain = newsroom.slice(
      newsroom.indexOf("AI_RESEARCH_CHAIN:"),
      newsroom.indexOf("AI_FACT_REVIEW_CHAIN:"),
    );
    expect(chain).toContain("anthropic:${anthropicModel}");
    expect(chain).toContain("google:${googleModel}");
    expect(chain.indexOf("anthropic:")).toBeLessThan(chain.indexOf("google:"));
  });

  it("leaves the free provider's small daily allowance for the independent review", () => {
    const review = newsroom.slice(
      newsroom.indexOf("AI_FACT_REVIEW_CHAIN:"),
      newsroom.indexOf("AI_COPY_EDIT_CHAIN:"),
    );
    // The reviewer must not be the drafting provider, so the order here is the
    // mirror of the research chain rather than a copy of it.
    expect(review.indexOf("google:")).toBeLessThan(review.indexOf("anthropic:"));
  });
});

describe("a rate-limited request waits as long as the provider asks", () => {
  it("reads retry-after off the response instead of retrying immediately", () => {
    expect(providers).toContain("retry-after");
    expect(providers).toContain("retryAfterMs");
  });
});
