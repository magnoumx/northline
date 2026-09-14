import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("autonomous newsroom has durable schedule, generation, and audit state", () => {
  const schedules = read("lib/jobs/schedules.ts");
  const handlers = read("lib/jobs/handlers.ts");
  const executors = read("lib/jobs/executors.ts");
  const migration = read("drizzle/0012_v13_autonomous_newsroom.sql");
  assert.match(schedules, /article\.autodraft/u);
  assert.match(handlers, /article\.generate/u);
  assert.match(executors, /AUTONOMOUS_DRAFT_DAILY_LIMIT/u);
  assert.match(executors, /AUTONOMOUS_MAX_ATTEMPTS/u);
  assert.match(executors, /AUTONOMOUS_DAILY_COST_LIMIT_USD/u);
  assert.match(executors, /AUTONOMOUS_ALLOW_QUICK_BRIEFS/u);
  assert.match(executors, /autonomous_daily_cost_limit_reached/u);
  assert.match(executors, /isNonRetryableAutonomousError/u);
  assert.match(executors, /AI_PROVIDER_TIMEOUT/u);
  assert.match(migration, /autonomous_story_runs/u);
});

test("system approval is evidence gated and blocks high-risk categories", () => {
  const service = read("lib/editorial/autonomous-newsroom.ts");
  const writeService = read("lib/editorial/article-write-service.ts");
  assert.match(service, /minimumPrimarySources:\s*1/u);
  assert.match(service, /minimumIndependentSources:\s*2/u);
  assert.match(service, /HIGH_RISK_CATEGORIES/u);
  assert.match(service, /reviewProvider !== research\.metadata\.provider/u);
  assert.match(service, /reviewGroundedSourceUrls\.length >= 2/u);
  assert.match(service, /wordCount < profile\.minWords/u);
  assert.match(writeService, /supportedClaims !== gate\.totalClaims/u);
  assert.match(writeService, /ARTICLE_SYSTEM_APPROVED/u);
});

test("queue concurrency is bounded for paid autonomous work", () => {
  const wrangler = read("wrangler.jsonc");
  const batchSizes = [...wrangler.matchAll(/"max_batch_size":\s*(\d+)/gu)].map((match) => Number(match[1]));
  assert.ok(batchSizes.length >= 3);
  // A batch larger than one lets two AI jobs run at the same time, which
  // contradicts the documented single-concurrency guarantee.
  assert.ok(batchSizes.every((size) => size === 1));
  const editorialConsumers = [
    ...wrangler.matchAll(
      /"queue":\s*"northline-editorial"[\s\S]{0,240}?"max_concurrency":\s*(\d+)/gu,
    ),
  ].map((match) => Number(match[1]));
  assert.ok(editorialConsumers.length >= 1);
  assert.ok(editorialConsumers.every((value) => value === 1));
});

test("published articles receive natural ElevenLabs audio through R2", () => {
  const executors = read("lib/jobs/executors.ts");
  const schedules = read("lib/jobs/schedules.ts");
  assert.match(executors, /ELEVENLABS/u);
  assert.match(executors, /xi-api-key/u);
  assert.match(schedules, /article_audio\.backfill/u);
  assert.match(executors, /FULL_ARTICLE/u);
});

test("public stories default to full article and have controlled AdSense slots", () => {
  const storyPage = read("components/public/story-pages.tsx");
  const slot = read("components/google-ad-slot.tsx");
  assert.match(storyPage, /function ArticleBody/u);
  assert.match(storyPage, /article_top/u);
  assert.match(storyPage, /article_mid/u);
  assert.match(storyPage, /article_end/u);
  assert.match(slot, /Advertisement/u);
  assert.match(slot, /data-ad-slot/u);
});

test("final operator configuration and launch documentation exist", () => {
  assert.equal(existsSync("scripts/configure-final-autonomous-newsroom.ps1"), true);
  assert.equal(existsSync("app/api/newsroom/autonomous/status/route.ts"), true);
});
