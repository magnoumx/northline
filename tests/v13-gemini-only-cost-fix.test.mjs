import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("autonomous review can use a different Gemini model without Claude", () => {
  const source = read("lib/editorial/autonomous-newsroom.ts");
  assert.doesNotMatch(source, /excludeProviders: \[research\.metadata\.provider\]/u);
  assert.match(
    source,
    /reviewProvider !== research\.metadata\.provider \|\|\s*reviewModel !== research\.metadata\.model/u,
  );
});

test("autonomous token budgets are bounded", () => {
  const source = read("lib/editorial/autonomous-newsroom.ts");
  assert.match(source, /maxInputTokens: format === "DEEP_EXPLAINER" \? 80_000 : 60_000/u);
  assert.match(source, /maxOutputTokens: format === "DEEP_EXPLAINER" \? 8_000 : 6_000/u);
  assert.doesNotMatch(source, /400_000 : 250_000/u);
});

test("manual research accepts Google", () => {
  const source = read("app/api/newsroom/ai/research-draft/route.ts");
  assert.match(source, /AI_GOOGLE_ENABLED === "true"/u);
  assert.match(source, /!hasEnabledResearchProvider/u);
});

test("future configuration is Gemini only and low cost", () => {
  const source = read("scripts/configure-final-autonomous-newsroom.ps1");
  assert.match(source, /AI_PROVIDER_ORDER = "google,local"/u);
  assert.match(source, /AI_ANTHROPIC_ENABLED = "false"/u);
  assert.match(source, /AI_DRAFTING_CHAIN = "google:gemini-2\.5-flash"/u);
  assert.match(source, /AI_MAX_OUTPUT_TOKENS = "6000"/u);
  assert.match(source, /AUTONOMOUS_DRAFT_BATCH_SIZE = "1"/u);
});
