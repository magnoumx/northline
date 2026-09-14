import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("system approval still requires two grounded review sources", () => {
  const source = read("lib/editorial/autonomous-newsroom.ts");
  assert.match(source, /reviewGroundedSourceUrls\.length >= 2/u);
});

test("audio backfill honors configured variants", () => {
  const source = read("lib/jobs/executors.ts");
  assert.match(source, /parseArticleAudioVariants/u);
  assert.match(source, /for \(const variant of audioVariants\)/u);
  assert.doesNotMatch(
    source,
    /for \(const variant of \["FULL_ARTICLE", "QUICK_BRIEF"\] as const\)/u,
  );
});

test("ElevenLabs failures preserve a bounded provider reason", () => {
  const source = read("lib/jobs/executors.ts");
  assert.match(source, /elevenlabs_tts_failed/u);
  assert.match(source, /ElevenLabs TTS failed with \$\{response\.status\}: \$\{detail\}/u);
});

test("failed audio generations can receive a fresh reservation", () => {
  const source = read("lib/audio/d1-repository.ts");
  assert.match(source, /retryAttempt/u);
  assert.match(source, /retry:\$\{retryAttempt\}/u);
  assert.match(source, /activeStates\.has\(row\.state\)/u);
});

test("reader defaults to the ready natural track", () => {
  const source = read("components/reader-actions.tsx");
  assert.match(
    source,
    /metadata\?\.quick\?\.state === "READY" && Boolean\(metadata\.quick\.src\)/u,
  );
});

test("editor blocks approval until the publication packet is complete", () => {
  const service = read("lib/editorial/article-write-service.ts");
  const editor = read("components/newsroom/article-editor.tsx");
  assert.match(service, /AS sourceCount/u);
  assert.match(service, /AS primarySourceCount/u);
  assert.match(editor, /Evidence incomplete/u);
  assert.match(editor, /article\.sourceCount >= 2/u);
});
