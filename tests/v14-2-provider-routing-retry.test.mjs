import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("free Gemini may draft public material but cannot fact-review for auto-publish", () => {
  const source = read("lib/ai/gateway.ts");
  assert.match(source, /allowsFreePublicDraftingProvider/u);
  assert.match(source, /provider\.id !== "google"/u);
  assert.match(source, /request\.dataClass !== "PUBLIC"/u);
  assert.match(source, /"research_synthesis"/u);
  assert.match(source, /"draft"/u);
  assert.doesNotMatch(
    source.slice(
      source.indexOf("function allowsFreePublicDraftingProvider"),
      source.indexOf("export function createAiGateway"),
    ),
    /"fact_review"/u,
  );
});

test("manual research accepts Google without requiring Anthropic", () => {
  const source = read("app/api/newsroom/ai/research-draft/route.ts");
  assert.match(source, /AI_GOOGLE_ENABLED === "true"/u);
  assert.match(source, /!hasEnabledResearchProvider/u);
  assert.doesNotMatch(
    source,
    /AI_GLOBAL_KILL !== "false" \|\|\s*process\.env\.AI_ANTHROPIC_ENABLED !== "true"/u,
  );
});

test("autonomous final fact review remains Claude-only", () => {
  const source = read("scripts/configure-final-autonomous-newsroom.ps1");
  assert.match(
    source,
    /AI_FACT_REVIEW_CHAIN = "anthropic:claude-haiku-4-5-20251001"/u,
  );
  assert.match(source, /AI_ANTHROPIC_CAPABILITIES = "fact_review"/u);
  assert.match(source, /AI_GOOGLE_TIER = "free"/u);
});
