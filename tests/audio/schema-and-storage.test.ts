import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildChunkAudioObjectKey,
  buildFinalAudioObjectKey,
} from "../../lib/audio";

describe("article audio persistence contracts", () => {
  it("has durable audio, chunk, cost, and authenticated resume tables", () => {
    const migration = readFileSync(
      resolve("drizzle/0006_v4_article_audio.sql"),
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE `article_audio_versions`");
    expect(migration).toContain("CREATE TABLE `article_audio_chunks`");
    expect(migration).toContain("CREATE TABLE `article_audio_cost_ledger`");
    expect(migration).toContain("CREATE TABLE `article_audio_progress`");
    expect(migration).toContain("article_audio_state_transition_guard");
    expect(migration).toContain("article_audio_cost_ledger_no_update");
  });

  it("builds deterministic version-scoped immutable object keys", () => {
    expect(
      buildFinalAudioObjectKey({
        prefix: "article-audio/v4",
        articleId: "article_12345678",
        articleVersionId: "version_12345678",
        variant: "FULL_ARTICLE",
        inputHash: "hash_12345678",
        outputFormat: "MP3",
        generationAttempt: 1,
      }),
    ).toBe(
      "article-audio/v4/article_12345678/version_12345678/full_article/hash_12345678-a1.mp3",
    );
    expect(
      buildChunkAudioObjectKey({
        prefix: "article-audio/v4",
        articleAudioVersionId: "audio_12345678",
        ordinal: 2,
        textHash: "text_hash_12345678",
        outputFormat: "MP3",
      }),
    ).toBe(
      "article-audio/v4/_chunks/audio_12345678/2-text_hash_12345678.mp3",
    );
  });

  it("rejects traversal-like object identifiers", () => {
    expect(() =>
      buildFinalAudioObjectKey({
        prefix: "article-audio/v4",
        articleId: "..",
        articleVersionId: "version_12345678",
        variant: "FULL_ARTICLE",
        inputHash: "hash_12345678",
        outputFormat: "MP3",
        generationAttempt: 1,
      }),
    ).toThrow("path segment");
  });
});
