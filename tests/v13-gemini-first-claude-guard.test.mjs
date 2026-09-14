import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Claude receives a compact one-pass fact review packet", () => {
  const source = read("lib/editorial/autonomous-newsroom.ts");
  assert.match(source, /maxInputTokens: 16_000/u);
  assert.match(source, /maxOutputTokens: 1_600/u);
  assert.match(source, /summary: evidence\.summary\.slice\(0, 700\)/u);
  assert.match(source, /Do not rewrite the article/u);
});

test("Gemini performs copy editing without forcing Claude", () => {
  const source = read("lib/editorial/autonomous-newsroom.ts");
  const copyStart = source.indexOf("const copyReview = await gateway.copyEdit");
  const copyEnd = source.indexOf("copyReviewProvider =", copyStart);
  const copyBlock = source.slice(copyStart, copyEnd);
  assert.doesNotMatch(copyBlock, /excludeProviders/u);
  assert.match(copyBlock, /maxOutputTokens: 4_000/u);
});

test("research token ceilings are bounded", () => {
  const source = read("lib/editorial/autonomous-newsroom.ts");
  assert.match(source, /90_000 : 60_000/u);
  assert.match(source, /8_000 : 6_000/u);
  assert.doesNotMatch(source, /400_000 : 250_000/u);
});

test("future configuration keeps Sonnet out of the newsroom", () => {
  const source = read("scripts/configure-final-autonomous-newsroom.ps1");
  assert.match(source, /AI_PROVIDER_ORDER = "google,anthropic,local"/u);
  assert.match(source, /AI_ANTHROPIC_CAPABILITIES = "fact_review"/u);
  assert.match(source, /AI_DRAFTING_CHAIN = "google:gemini-2\.5-flash"/u);
  assert.match(
    source,
    /AI_FACT_REVIEW_CHAIN = "anthropic:claude-haiku-4-5-20251001"/u,
  );
  assert.doesNotMatch(source, /AI_RESEARCH_CHAIN = "anthropic:/u);
});
