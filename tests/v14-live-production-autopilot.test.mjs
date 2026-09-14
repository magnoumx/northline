import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("the official site cannot fall back to fictional fixtures", () => {
  const service = read("lib/content/read-service.ts");
  const types = read("lib/content/types.ts");
  assert.match(service, /productionSiteConfigured/u);
  assert.match(service, /usnorthline\\\.com/u);
  assert.match(types, /NEXT_PUBLIC_SITE_URL\?: string/u);
});

test("reader-facing database pages are runtime dynamic", () => {
  for (const path of [
    "app/page.tsx",
    "app/latest/page.tsx",
    "app/trending/page.tsx",
    "app/live/page.tsx",
    "app/search/page.tsx",
    "app/[...slug]/page.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /export const dynamic = "force-dynamic"/u, path);
    assert.match(source, /export const revalidate = 0/u, path);
  }
});

test("autonomous queue prioritizes importance and licensed-media potential", () => {
  const source = read("lib/jobs/executors.ts");
  assert.match(source, /AS priorityScore/u);
  assert.match(source, /visual_availability/u);
  assert.match(source, /youtube\.com/u);
  assert.match(source, /ORDER BY priorityScore DESC/u);
});

test("low-risk verified stories are not blocked by an optional copy-edit outage", () => {
  const source = read("lib/editorial/autonomous-newsroom.ts");
  assert.doesNotMatch(source, /reasons\.push\("copy_review_incomplete"\)/u);
  assert.match(source, /suppliedEvidenceGroundedReview/u);
  assert.match(source, /Claude Haiku fact review/u);
});

test("future production configuration disables demo mode and batches secrets", () => {
  const source = read("scripts/configure-final-autonomous-newsroom.ps1");
  assert.match(source, /APP_ENV = \$\(if \(\$Environment -eq "production"\)/u);
  assert.match(source, /DEMO_CONTENT_MODE = "false"/u);
  assert.match(source, /NEXT_PUBLIC_SITE_URL/u);
  assert.match(source, /\$batchSize = 90/u);
});
