import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A correlated `LIKE '%' || a.id || '%'` cannot use an index, so D1 scans the
// whole table once per outer row. Against audit_logs in the video backfill it
// read 69 billion rows in October 2026 (the whole Cloudflare invoice). Keep
// the pattern out of runtime code entirely; match on an indexed column instead.

const root = fileURLToPath(new URL("../..", import.meta.url));

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/u.test(entry)) files.push(path);
  }
  return files;
}

describe("D1 query guard", () => {
  it("never builds a LIKE pattern from a column value", () => {
    const offenders = ["lib", "app", "worker"]
      .flatMap((directory) => sourceFiles(join(root, directory)))
      .filter((file) =>
        /LIKE\s+'%'\s*\|\|/iu.test(readFileSync(file, "utf8").replace(/\s+/gu, " ")),
      )
      .map((file) => relative(root, file));
    expect(offenders).toEqual([]);
  });
});
