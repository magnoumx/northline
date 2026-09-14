import { describe, expect, it, vi } from "vitest";
import {
  AI_ILLUSTRATION_DISCLOSURE,
  buildIllustrationPrompt,
  registerAiIllustration,
} from "../../lib/media/ai-illustration";

const topic = {
  headline: "Senate Advances Spending Bill After Overnight Talks",
  category: "POLITICS",
  summary: "Negotiators reached a procedural agreement before the deadline.",
};

describe("ai illustration prompt", () => {
  it("never asks for a depiction that could pass as evidence", () => {
    const prompt = buildIllustrationPrompt(topic);

    for (const banned of [
      "no recognisable real people",
      "no faces",
      "no reconstructed news scenes",
      "no photographic realism",
    ]) {
      expect(prompt).toContain(banned);
    }
    expect(prompt).toContain("Abstract editorial illustration");
  });

  it("varies the motif by category so every story does not look alike", () => {
    const politics = buildIllustrationPrompt(topic);
    const sports = buildIllustrationPrompt({ ...topic, category: "SPORTS" });

    expect(politics).not.toBe(sports);
    expect(sports).toContain("motion arcs");
  });

  it("uses the summary for mood without asking it to be drawn literally", () => {
    const prompt = buildIllustrationPrompt(topic);
    expect(prompt).toContain("Mood suggested by the subject");
    expect(prompt).not.toMatch(/depict|show the|illustrate the event/iu);
  });

  it("falls back to a neutral motif for an unknown category", () => {
    const prompt = buildIllustrationPrompt({ ...topic, category: "WEIRD" });
    expect(prompt).toContain("abstract editorial geometry");
  });
});

function fakeStore() {
  const statements: unknown[][] = [];
  const puts: { key: string; size: number }[] = [];
  const database = {
    prepare() {
      const row: unknown[] = [];
      return {
        bind(...bindings: unknown[]) {
          row.push(...bindings);
          statements.push(row);
          return this;
        },
      };
    },
    async batch() {
      return [];
    },
  };
  const bucket = {
    async put(key: string, bytes: Uint8Array) {
      puts.push({ key, size: bytes.byteLength });
    },
  };
  return { database, bucket, statements, puts };
}

describe("ai illustration registration", () => {
  it("stores the artwork and carries the disclosure with the asset", async () => {
    const store = fakeStore();
    const result = await registerAiIllustration({
      ...topic,
      database: store.database as unknown as D1Database,
      bucket: store.bucket as unknown as R2Bucket,
      articleVersionId: "version_x_1",
      slug: "senate-advances-spending-bill",
      run: async () => new Uint8Array(8_192).fill(7),
      now: new Date(1_700_000_000_000),
    });

    expect(result).not.toBeNull();
    expect(store.puts).toHaveLength(1);
    expect(store.puts[0].key).toContain("generated/ai-illustration/");

    const bindings = store.statements.flat().map(String);
    expect(
      bindings.some((value) => value.includes(AI_ILLUSTRATION_DISCLOSURE)),
    ).toBe(true);
    expect(
      bindings.some((value) => value.includes("Not a photograph of the event")),
    ).toBe(true);
    // Alt text describes the artwork, not the news event.
    expect(
      bindings.some((value) =>
        value.startsWith("Abstract editorial illustration accompanying:"),
      ),
    ).toBe(true);
  });

  it("treats an empty or truncated render as no image at all", async () => {
    const store = fakeStore();
    for (const bytes of [null, new Uint8Array(64)]) {
      const result = await registerAiIllustration({
        ...topic,
        database: store.database as unknown as D1Database,
        bucket: store.bucket as unknown as R2Bucket,
        articleVersionId: "version_x_1",
        slug: "senate",
        run: async () => bytes,
      });
      expect(result).toBeNull();
    }
    expect(store.puts).toHaveLength(0);
  });

  it("returns null rather than throwing when the model errors", async () => {
    const store = fakeStore();
    const run = vi.fn(async () => {
      throw new Error("model unavailable");
    });

    await expect(
      registerAiIllustration({
        ...topic,
        database: store.database as unknown as D1Database,
        bucket: store.bucket as unknown as R2Bucket,
        articleVersionId: "version_x_1",
        slug: "senate",
        run,
      }),
    ).resolves.toBeNull();
    expect(run).toHaveBeenCalledOnce();
  });
});
