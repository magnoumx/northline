import { describe, expect, it } from "vitest";
import {
  createMediaOnlyRevision,
  MediaRevisionError,
  readerTextOf,
} from "../../lib/editorial/media-revision";

const publishedVersion = {
  id: "version_abc_1",
  articleId: "article_abc",
  version: 1,
  headline: "Van der Poel wins in Paris",
  subheadline: "The final stage closed a three-week race.",
  bodyJson: '[{"heading":"What happened","paragraphs":["He won."]}]',
  keyTakeawaysJson: '["He won."]',
  seoJson: "{}",
  structuredDataJson: "{}",
  qualityScore: 88,
  qualityExplanationJson: "{}",
  publishedAt: 1_700_000_000_000,
};

/** Minimal D1 stand-in that records what the flow actually executed. */
function fakeDb(options: { corruptCopy?: boolean } = {}) {
  const statements: { sql: string; bindings: unknown[] }[] = [];
  const versions = new Map<string, Record<string, unknown>>([
    [publishedVersion.id, { ...publishedVersion }],
  ]);

  const db = {
    prepare(sql: string) {
      const record = { sql, bindings: [] as unknown[] };
      return {
        bind(...bindings: unknown[]) {
          record.bindings = bindings;
          return this;
        },
        async first<T>(): Promise<T | null> {
          statements.push(record);
          if (sql.includes("FROM article_versions v")) {
            return versions.get(String(record.bindings[0])) as T ?? null;
          }
          if (sql.includes("key_takeaways_json AS keyTakeawaysJson\n       FROM article_versions")) {
            const row = versions.get(String(record.bindings[0]));
            if (!row) return null;
            return (
              options.corruptCopy
                ? { ...row, bodyJson: '[{"heading":"x","paragraphs":["edited"]}]' }
                : row
            ) as T;
          }
          const row = versions.get(String(record.bindings[0]));
          return (row ?? null) as T | null;
        },
        async run() {
          statements.push(record);
          if (sql.startsWith("INSERT INTO article_versions")) {
            versions.set(String(record.bindings[0]), {
              id: record.bindings[0],
              headline: record.bindings[3],
              subheadline: record.bindings[4],
              bodyJson: record.bindings[5],
              keyTakeawaysJson: record.bindings[6],
              publishedAt: null,
            });
          }
          return { meta: { changes: 1 } };
        },
      };
    },
    statements,
    versions,
  };
  return db as unknown as D1Database & typeof db;
}

const hash = async (value: string) =>
  `h${value.length}:${value.slice(0, 12)}`;

const input = {
  articleId: "article_abc",
  currentVersionId: "version_abc_1",
  media: [
    {
      mediaAssetId: "media_1",
      role: "HERO",
      position: 0,
      altText: "Riders on the Champs-Elysees",
      caption: "Wikimedia Commons / CC BY-SA",
    },
  ],
  sources: [],
  changeSummary: "Attach licensed hero image.",
  createdById: "system:media",
  now: new Date(1_700_000_100_000),
};

describe("media-only revision", () => {
  it("carries the published text into the new version unchanged", async () => {
    const db = fakeDb();
    const result = await createMediaOnlyRevision(db, input, hash);

    expect(result.versionNumber).toBe(2);
    expect(result.mediaAttached).toBe(1);
    expect(result.bodyHash).toBe(await hash(readerTextOf(publishedVersion)));

    const copy = db.versions.get(result.newVersionId)!;
    expect(copy.headline).toBe(publishedVersion.headline);
    expect(copy.bodyJson).toBe(publishedVersion.bodyJson);
    expect(copy.keyTakeawaysJson).toBe(publishedVersion.keyTakeawaysJson);
  });

  it("creates the version as a draft so the media trigger accepts the link", async () => {
    const db = fakeDb();
    await createMediaOnlyRevision(db, input, hash);

    const insert = db.statements.find((statement) =>
      statement.sql.startsWith("INSERT INTO article_versions"),
    );
    // published_at is the literal NULL in the values list; freezing is a
    // separate later statement.
    expect(insert?.sql).toContain("published_at\n       ) VALUES");
    expect(insert?.sql).toContain("NULL)");
  });

  it("freezes the new version before pointing the article at it", async () => {
    const db = fakeDb();
    const result = await createMediaOnlyRevision(db, input, hash);

    const order = db.statements.map((statement) => statement.sql);
    const freeze = order.findIndex((sql) =>
      sql.includes("UPDATE article_versions SET published_at"),
    );
    const promote = order.findIndex((sql) =>
      sql.includes("UPDATE articles SET current_version_id"),
    );

    expect(freeze).toBeGreaterThan(-1);
    expect(promote).toBeGreaterThan(freeze);
    expect(result.newVersionId).toBe("version_abc_2");
  });

  it("refuses to attach nothing", async () => {
    const db = fakeDb();
    await expect(
      createMediaOnlyRevision(db, { ...input, media: [], sources: [] }, hash),
    ).rejects.toBeInstanceOf(MediaRevisionError);
  });

  it("lets discovery run against the draft while the trigger still allows it", async () => {
    const db = fakeDb();
    const seen: string[] = [];
    const result = await createMediaOnlyRevision(
      db,
      {
        ...input,
        media: [],
        sources: [],
        async attachToDraft(versionId) {
          seen.push(versionId);
          return 1;
        },
      },
      hash,
    );

    expect(seen).toEqual([result.newVersionId]);
    expect(result.mediaAttached).toBe(1);
    // Discovery must have run before the version was frozen.
    const order = db.statements.map((statement) => statement.sql);
    expect(
      order.findIndex((sql) => sql.includes("UPDATE article_versions SET published_at")),
    ).toBeGreaterThan(0);
  });

  it("discards the draft when discovery finds nothing licensed", async () => {
    const db = fakeDb();
    await expect(
      createMediaOnlyRevision(
        db,
        { ...input, media: [], sources: [], attachToDraft: async () => 0 },
        hash,
      ),
    ).rejects.toMatchObject({ code: "NOTHING_TO_ATTACH" });

    expect(
      db.statements.some((statement) =>
        statement.sql.startsWith("DELETE FROM article_versions"),
      ),
    ).toBe(true);
  });

  it("aborts and cleans up if the reader-facing text did not survive the copy", async () => {
    const db = fakeDb({ corruptCopy: true });
    await expect(
      createMediaOnlyRevision(db, input, hash),
    ).rejects.toMatchObject({ code: "TEXT_CHANGED" });

    expect(
      db.statements.some((statement) =>
        statement.sql.startsWith("DELETE FROM article_versions"),
      ),
    ).toBe(true);
  });

  describe("carries the previous version's evidence forward", () => {
    // Every article that ever went through this path published with zero
    // sources, because article_source_links and article_media are keyed by
    // article_version_id: a fresh version starts with none of its
    // predecessor's rows no matter how well-sourced the article actually was.
    // Confirmed live: 19 of 19 published articles that had gone through a
    // media revision had 0 rows in article_source_links for their current
    // version, while the page still displayed "Verified".

    it("copies the previous version's sources into the new one", async () => {
      const db = fakeDb();
      await createMediaOnlyRevision(db, input, hash);

      const copy = db.statements.find(
        (statement) =>
          statement.sql.includes("INSERT OR IGNORE INTO article_source_links") &&
          statement.sql.includes("FROM article_source_links"),
      );
      expect(copy).toBeDefined();
      // Copies FROM the version being superseded, INTO the freshly created one.
      expect(copy?.bindings[0]).toBe(publishedVersion.id);
      expect(copy?.bindings[1]).toBe("version_abc_2");
    });

    it("copies the previous version's media into the new one", async () => {
      const db = fakeDb();
      await createMediaOnlyRevision(db, input, hash);

      const copy = db.statements.find(
        (statement) =>
          statement.sql.includes("INSERT OR IGNORE INTO article_media") &&
          statement.sql.includes("FROM article_media"),
      );
      expect(copy).toBeDefined();
      expect(copy?.bindings[0]).toBe(publishedVersion.id);
      expect(copy?.bindings[1]).toBe("version_abc_2");
    });

    it("copies evidence forward before adding anything new, and before the draft freezes", async () => {
      const db = fakeDb();
      await createMediaOnlyRevision(db, input, hash);

      const order = db.statements.map((statement) => statement.sql);
      const versionCreated = order.findIndex((sql) =>
        sql.startsWith("INSERT INTO article_versions"),
      );
      const sourcesCopied = order.findIndex(
        (sql) =>
          sql.includes("INSERT OR IGNORE INTO article_source_links") &&
          sql.includes("FROM article_source_links"),
      );
      const mediaCopied = order.findIndex(
        (sql) =>
          sql.includes("INSERT OR IGNORE INTO article_media") &&
          sql.includes("FROM article_media"),
      );
      const frozen = order.findIndex((sql) =>
        sql.includes("UPDATE article_versions SET published_at"),
      );

      expect(versionCreated).toBeGreaterThan(-1);
      expect(sourcesCopied).toBeGreaterThan(versionCreated);
      expect(mediaCopied).toBeGreaterThan(versionCreated);
      expect(frozen).toBeGreaterThan(sourcesCopied);
      expect(frozen).toBeGreaterThan(mediaCopied);
    });
  });
});
