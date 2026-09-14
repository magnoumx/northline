import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("production contract is fail-closed", () => {
  const env = read(".env.production.minimal.example");
  assert.match(env, /^APP_ENV=production$/m);
  assert.match(env, /^DEMO_CONTENT_MODE=false$/m);
  assert.match(env, /^ENABLE_SEARCH_INDEXING=false$/m);
  assert.match(env, /^FEATURE_AUTO_PUBLISH=true$/m);
  assert.match(env, /^AUTO_PUBLISH_MODE=approved_only$/m);
  assert.match(env, /^AUTO_PUBLISH_DAILY_LIMIT=5$/m);
  assert.match(env, /^AI_ENABLED=false$/m);
  assert.match(env, /^AI_GLOBAL_KILL=true$/m);
});

test("production assets and workflows exist", () => {
  for (const path of [
    "public/brand/logo.svg",
    "public/brand/wordmark.svg",
    "app/api/newsroom/media/route.ts",
    "app/api/newsroom/sources/route.ts",
    "app/api/newsroom/newsletters/route.ts",
    "app/api/newsroom/ai/review-package/route.ts",
    "components/newsroom/article-editor.tsx",
    "components/newsroom/media-workspace.tsx",
    "components/newsroom/newsletter-workspace.tsx",
    "drizzle/0008_newsletter_briefing_batches.sql",
    "drizzle/0009_newsletter_editorial_permission.sql",
  ]) {
    assert.equal(existsSync(path), true, `${path} must exist`);
  }
});

test("production public content cannot fall back to fixtures", () => {
  const readService = read("lib/content/read-service.ts");
  assert.match(readService, /APP_ENV/u);
  assert.match(readService, /DEMO_CONTENT_MODE/u);
  assert.match(readService, /production/iu);
  const header = read("components/site-header-client.tsx");
  assert.match(header, /demoMode \?/u);
});

test("editorial actions preserve human approval gates", () => {
  const articleRoute = read("app/api/newsroom/articles/[articleId]/route.ts");
  assert.match(articleRoute, /submit/u);
  assert.match(articleRoute, /approve/u);
  assert.match(articleRoute, /publish/u);
  const environment = read(".env.production.minimal.example");
  assert.match(environment, /AUTO_PUBLISH_READINESS_APPROVED=true/u);
  assert.match(environment, /AUTO_PUBLISH_MODE=approved_only/u);
});

test("media upload is quarantined and signature checked", () => {
  const media = read("app/api/newsroom/media/route.ts");
  assert.match(media, /MEDIA_QUARANTINE/u);
  assert.match(media, /detectImage/u);
  assert.match(media, /checksum_sha256/u);
  assert.match(media, /QUARANTINED/u);
});

test("newsletter signup and editorial issue workflows are unified", () => {
  const publicForm = read("components/newsletter-form.tsx");
  assert.match(publicForm, /const \[selected/u);
  const newsletterRoute = read("app/api/newsroom/newsletters/route.ts");
  assert.match(newsletterRoute, /newsletter\.manage/u);
  assert.match(newsletterRoute, /Nothing was sent|non-sendable draft|explicit delivery/iu);
});

test("secret and generated runtime files are excluded", () => {
  const ignore = read(".gitignore");
  assert.match(ignore, /^\.dev\.vars$/m);
  assert.match(ignore, /^outputs\/$/m);
});
