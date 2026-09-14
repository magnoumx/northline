import { describe, expect, it } from "vitest";
import {
  buildBackupSnapshot,
  canonicalize,
  verifyBackupSnapshot,
} from "../../lib/operations/backup";

const tables = {
  articles: [
    { id: "a1", headline: "Zebra story" },
    { id: "a2", headline: "Alpha story" },
  ],
  sections: [{ id: "s1", name: "Politics" }],
};

describe("backup snapshot", () => {
  it("round-trips a snapshot with an integrity checksum", async () => {
    const snapshot = await buildBackupSnapshot(tables, {
      createdAt: new Date("2026-07-24T00:00:00Z"),
    });
    const result = await verifyBackupSnapshot(snapshot);
    expect(result.valid).toBe(true);
    expect(result.tables.sort()).toEqual(["articles", "sections"]);
    expect(result.rowCount).toBe(3);
  });

  it("is deterministic regardless of key insertion order", async () => {
    const fixedDate = new Date("2026-01-01T00:00:00Z");
    const a = await buildBackupSnapshot({ b: [{ x: 1 }], a: [{ y: 2 }] }, { createdAt: fixedDate });
    const b = await buildBackupSnapshot({ a: [{ y: 2 }], b: [{ x: 1 }] }, { createdAt: fixedDate });
    expect(a.checksum).toBe(b.checksum);
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("detects tampering", async () => {
    const snapshot = await buildBackupSnapshot(tables);
    const tampered = {
      ...snapshot,
      tables: { ...snapshot.tables, articles: [{ id: "evil" }] },
    };
    await expect(verifyBackupSnapshot(tampered)).rejects.toThrow(/checksum mismatch/i);
  });

  it("rejects malformed snapshots", async () => {
    await expect(verifyBackupSnapshot(null)).rejects.toThrow();
    await expect(verifyBackupSnapshot({ version: 99 })).rejects.toThrow(/version/i);
    await expect(verifyBackupSnapshot({ version: 1, createdAt: "x", tables: {}, checksum: "" })).rejects.toThrow(/checksum/i);
  });

  it("rejects non-array table payloads", async () => {
    await expect(
      buildBackupSnapshot({ bad: { not: "an array" } as unknown as unknown[] }),
    ).rejects.toThrow(/array/i);
  });
});
