import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repository = readFileSync(
  fileURLToPath(new URL("../../lib/audio/d1-repository.ts", import.meta.url)),
  "utf8",
);
const schema = readFileSync(
  fileURLToPath(
    new URL("../../drizzle/0006_v4_article_audio.sql", import.meta.url),
  ),
  "utf8",
);

function chunkTableColumns(): string[] {
  const table = /CREATE TABLE `article_audio_chunks` \(([\s\S]*?)\n\);/u.exec(
    schema,
  );
  if (!table) throw new Error("article_audio_chunks table not found");
  return [...table[1].matchAll(/^\s*`([a-z_]+)`\s+(?:text|integer)([^,]*)/gimu)]
    .filter((match) => /NOT NULL/iu.test(match[2]) && !/DEFAULT/iu.test(match[2]))
    .map((match) => match[1]);
}

function chunkInsertColumns(): string[] {
  const insert = /INSERT INTO article_audio_chunks \(([\s\S]*?)\) VALUES/u.exec(
    repository,
  );
  if (!insert) throw new Error("chunk insert not found");
  return insert[1]
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

describe("article audio chunk persistence", () => {
  it("supplies every column the schema requires", () => {
    // The regression: generation_attempt is NOT NULL with a CHECK of >= 1 and
    // was never bound, so every chunk write failed and no narration was ever
    // stored - which surfaced as unrelated provider and budget errors.
    const required = chunkTableColumns();
    const supplied = new Set(chunkInsertColumns());

    expect(required).toContain("generation_attempt");
    for (const column of required) {
      expect(supplied.has(column), `${column} is not written`).toBe(true);
    }
  });

  it("binds an attempt that satisfies the >= 1 check", () => {
    expect(repository).toContain(
      "Math.max(1, Number(parent.generationAttempt ?? 1))",
    );
  });
});
