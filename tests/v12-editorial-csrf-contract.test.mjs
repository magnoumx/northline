import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("the editorial CSRF route and mutation clients use csrfToken consistently", () => {
  const route = read("app/api/newsroom/csrf/route.ts");
  const trendControls = read("components/newsroom/trend-decision-controls.tsx");
  const reviewWorkspace = read("components/newsroom/live-review-workspace.tsx");

  assert.match(route, /\{ csrfToken: await issueEditorialCsrf\(access\.user\) \}/u);
  assert.match(trendControls, /csrfToken\?: string/u);
  assert.match(trendControls, /"x-csrf-token": csrfBody\.csrfToken/u);
  assert.doesNotMatch(trendControls, /csrfBody\.token/u);
  assert.match(reviewWorkspace, /csrfToken\?: string/u);
  assert.match(reviewWorkspace, /return payload\.csrfToken/u);
  assert.doesNotMatch(reviewWorkspace, /return payload\.token/u);
});

test("the U.S. source registry contains exactly 100 reviewed rows", () => {
  const seed = read("scripts/seed-editorial-sources.sql");
  const ids = [...seed.matchAll(/'source_[a-z0-9_]+'/gu)].map((match) => match[0]);
  const unique = new Set(ids);
  assert.equal(unique.size, 100);
  assert.match(seed, /"sourceCount":100/u);
  assert.match(seed, /'link_only'/u);
  assert.match(seed, /ON CONFLICT\(domain\) DO UPDATE/u);
});
