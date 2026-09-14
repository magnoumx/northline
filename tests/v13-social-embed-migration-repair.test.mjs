import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("trusted editorial embeds support the approved provider allowlist", () => {
  const source = read("lib/media/editorial-embeds.ts");
  for (const provider of [
    "YouTube",
    "Vimeo",
    "TikTok",
    "Facebook",
    "Instagram",
    "X",
  ]) {
    assert.match(source, new RegExp(`provider: "${provider}"`, "u"));
  }
  assert.match(source, /youtube-nocookie\.com/u);
  assert.match(source, /player\.vimeo\.com/u);
  assert.match(source, /tiktok\.com\/player\/v1/u);
  assert.match(source, /facebook\.com\/plugins\/video\.php/u);
  assert.match(source, /instagram\.com/u);
  assert.match(source, /platform\.twitter\.com/u);
});

test("the public player offers expand, fullscreen, and source controls", () => {
  const source = read("components/editorial-media-embed.tsx");
  assert.match(source, /requestFullscreen/u);
  assert.match(source, /Compact/u);
  assert.match(source, /Source/u);
  assert.match(source, /loading="lazy"/u);
  assert.doesNotMatch(source, /allow="[^"]*autoplay/u);
  assert.match(source, /fullscreenchange/u);
});

test("the migrator is batched and exposes a readiness endpoint", () => {
  const source = read("scripts/northline-content-migrator.mjs");
  assert.match(source, /url\.pathname === "\/health"/u);
  assert.match(source, /boundedInteger\(url\.searchParams\.get\("limit"\), 1, 5, 3\)/u);
  assert.match(source, /nextCursor/u);
  assert.match(source, /mediaEnrichmentVersion = "v2"/u);
});

test("audio backfill can be restricted to quick briefs", () => {
  const source = read("lib/jobs/executors.ts");
  assert.match(source, /ARTICLE_AUDIO_VARIANTS/u);
  assert.match(source, /value \?\? "QUICK_BRIEF"/u);
  assert.match(source, /av\.variant IN/u);
});
