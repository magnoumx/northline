import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const layout = readFileSync(
  fileURLToPath(new URL("../../app/layout.tsx", import.meta.url)),
  "utf8",
);

// The feeds were advertised through metadata.alternates.types. Every page sets
// its own alternates.canonical, and Next.js replaces the whole alternates object
// rather than merging it, so the feed links never reached a single page.
describe("feed autodiscovery", () => {
  it("is declared as head links in the root layout, not as metadata", () => {
    expect(layout).toContain('type="application/rss+xml"');
    expect(layout).toContain('type="application/atom+xml"');
    expect(layout).not.toMatch(/alternates:\s*\{\s*\/\//u);
  });
});
