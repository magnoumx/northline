import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("article editor exposes protected AI research and regeneration controls", () => {
  const editor = read("components/newsroom/article-editor.tsx");
  assert.match(editor, /Research & generate draft/);
  assert.match(editor, /Regenerate selected section/);
  assert.match(editor, /\/api\/newsroom\/ai\/research-draft/);
  assert.match(editor, /\/api\/newsroom\/ai\/regenerate-section/);
  assert.match(editor, /publishableByModel: false/);
});

test("AI research route enforces source and human-review boundaries", () => {
  const route = read("app/api/newsroom/ai/research-draft/route.ts");
  assert.match(route, /AI_MIN_PRIMARY_SOURCES/);
  assert.match(route, /AI_MIN_INDEPENDENT_SOURCES/);
  assert.match(route, /review_required/);
  assert.match(route, /publishableByModel: false/);
  assert.match(route, /human approval remains required/i);
});

test("AI schemas include research, distribution, and locked section regeneration", () => {
  const schemas = read("lib/ai/editorial-schemas.ts");
  assert.match(schemas, /automatedResearchDraftSchema/);
  assert.match(schemas, /newsletterSummary/);
  assert.match(schemas, /socialPosts/);
  assert.match(schemas, /regeneratedSectionSchema/);
  assert.match(schemas, /factualPacketPreserved/);
});

test("preview configuration keeps autonomous publication disabled", () => {
  const script = read("scripts/configure-ai-drafting-preview.ps1");
  assert.match(script, /FEATURE_AUTO_PUBLISH = "false"/);
  assert.match(script, /AUTO_PUBLISH_READINESS_APPROVED = "false"/);
  assert.match(script, /AUTO_PUBLISH_MODE = "approved_only"/);
  assert.match(script, /AI_REQUIRE_HUMAN_APPROVAL = "true"/);
});
