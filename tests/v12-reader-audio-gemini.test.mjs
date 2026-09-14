import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("public stories open the full article", () => {
  const source = read("components/public/story-pages.tsx");
  assert.match(source, /function ArticleBody/u);
  assert.doesNotMatch(source, /role="tablist"/u);
});

test("audio opens the full article and uses browser speech fallback", () => {
  const source = read("components/reader-actions.tsx");
  assert.match(source, /metadata\?\.full \? "full" : "quick"/u);
  assert.match(source, /if \(!productionReady\) \{\s*toggleBrowserFallback\(\)/u);
  assert.match(source, /disabled=\{!productionReady && !fallbackSupported\}/u);
});
