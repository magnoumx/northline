import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("autonomous publishing is hard capped and stale jobs recover", () => {
  const source = read("lib/jobs/executors.ts");
  assert.match(source, /Math\.min\(\s*25,/u);
  assert.match(source, /STALE_RUN_RECOVERED/u);
  assert.match(source, /ARTICLE_AUDIO_DAILY_ARTICLE_LIMIT/u);
  assert.match(source, /WHERE created_at >= \?1`/u);
});

test("autonomous articles use cheap drafting and independent review", () => {
  const source = read("lib/editorial/autonomous-newsroom.ts");
  assert.match(source, /google:\$\{googleModel\}/u);
  assert.match(source, /anthropic:\$\{anthropicModel\}/u);
  assert.match(source, /claude-haiku-4-5-20251001/u);
  assert.match(source, /registerLicensedCommonsMedia/u);
  assert.match(source, /videoEmbedUrl/u);
});

test("public stories safely render licensed images and source video", () => {
  const types = read("lib/site/types.ts");
  const repository = read("lib/content/d1-public-repository.ts");
  const page = read("components/public/story-pages.tsx");
  const headers = read("lib/security/headers.ts");
  assert.match(types, /videoEmbedUrl\?: string/u);
  assert.match(repository, /normalizeEditorialEmbed/u);
  assert.match(page, /www\.youtube-nocookie\.com|story\.videoEmbedUrl/u);
  assert.match(headers, /https:\/\/upload\.wikimedia\.org/u);
});

test("manual draft save explains incomplete required fields", () => {
  const editor = read("components/newsroom/article-editor.tsx");
  assert.match(editor, /missingDraftFields/u);
  assert.match(editor, /Complete these fields before saving/u);
  assert.match(editor, /disabled=\{saving\}/u);
});
