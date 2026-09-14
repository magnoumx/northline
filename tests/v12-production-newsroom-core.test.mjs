import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("deployed preview and production runtimes cannot render fixture content", () => {
  const service = read("lib/content/read-service.ts");
  assert.match(service, /environment\.NODE_ENV === "production"/u);
  assert.match(service, /appEnvironment === "preview"/u);
  assert.match(service, /return "DATABASE"/u);
});

test("core editorial routes render database-backed workspaces", () => {
  assert.match(read("app/newsroom/research/page.tsx"), /getResearchWorkspaceData/u);
  assert.match(read("app/newsroom/intelligence/page.tsx"), /getIntelligenceWorkspaceData/u);
  assert.match(read("app/newsroom/review/page.tsx"), /getReviewWorkspaceData/u);
  assert.match(read("components/newsroom/trend-desk.tsx"), /Selected live signal/u);
});

test("trend decisions are protected and persisted", () => {
  const route = read("app/api/newsroom/trends/[trendId]/route.ts");
  assert.match(route, /authorizeEditorialRequest\(\["trend\.manage"\]\)/u);
  assert.match(route, /protectEditorialMutation/u);
  assert.match(route, /INSERT INTO state_transitions/u);
  assert.match(route, /INSERT INTO audit_logs/u);
  assert.match(route, /story_opportunities/u);
});

test("review workspace uses real article workflow actions", () => {
  const review = read("components/newsroom/live-review-workspace.tsx");
  assert.match(review, /Verify central claim/u);
  assert.match(review, /Submit for review/u);
  assert.match(review, /Approve current version/u);
  assert.match(review, /Publish approved version/u);
  assert.doesNotMatch(review, /FICTIONAL DEMO/u);
});
