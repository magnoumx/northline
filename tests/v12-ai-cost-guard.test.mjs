import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const providers = await readFile(new URL("../lib/ai/providers.ts", import.meta.url), "utf8");
const gateway = await readFile(new URL("../lib/ai/gateway.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/newsroom/ai/research-draft/route.ts", import.meta.url), "utf8");
const config = await readFile(new URL("../scripts/configure-ai-drafting-preview.ps1", import.meta.url), "utf8");
const migration = await readFile(new URL("../drizzle/0011_v12_ai_generation_cost_guard.sql", import.meta.url), "utf8");

test("Anthropic uses streaming and never retries a timed-out paid request", () => {
  assert.match(providers, /stream:\s*true/u);
  assert.match(providers, /attempts:\s*1/u);
  assert.match(providers, /Math\.min\(2, search\.maxUses\)/u);
  assert.match(providers, /request was not retried to prevent duplicate billing/u);
  assert.match(gateway, /lastError\.code === "AI_PROVIDER_TIMEOUT"/u);
  assert.match(gateway, /AI_BUDGET_SOFT_LIMIT_EXCEEDED/u);
  assert.match(gateway, /preserving_completed_paid_result/u);
});

test("research endpoint deduplicates, caches, and cools down failed paid requests", () => {
  assert.match(route, /ai_generation_requests/u);
  assert.match(route, /30 \* 60 \* 1_000/u);
  assert.match(route, /blocked another charge/u);
  assert.match(route, /sourceRegistryLimit/u);
  assert.match(route, /completeGenerationGuard/u);
  assert.match(route, /factReviewFallback/u);
});

test("Preview configuration starts killed and uses bounded search, timeout, and budgets", () => {
  assert.match(config, /AI_GLOBAL_KILL = "true"/u);
  assert.match(config, /AI_ANTHROPIC_WEB_SEARCH_MAX_USES = "2"/u);
  assert.match(config, /AI_PROVIDER_RETRY_ATTEMPTS = "1"/u);
  assert.match(config, /AI_PROVIDER_TIMEOUT_MS = "240000"/u);
  assert.match(config, /AI_PER_STORY_BUDGET_USD = "10\.00"/u);
  assert.match(config, /AI_PER_TASK_BUDGET_USD = "2\.00"/u);
});

test("generation guard migration is idempotent and keyed by request", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_generation_requests/u);
  assert.match(migration, /request_key TEXT NOT NULL UNIQUE/u);
  assert.match(migration, /actual_cost_micros/u);
});
