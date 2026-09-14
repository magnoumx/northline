import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression guards for the negative tests run against production.
 *
 * Each of these was probed live and passed. The point of writing them down is
 * that a future change cannot quietly remove the control that made them pass -
 * the probe is a moment in time, the test is permanent.
 */

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

describe("media route cannot be walked", () => {
  const route = read("app/media/[...key]/route.ts");

  it("serves only the generated prefix", () => {
    // The bucket also holds licensed and quarantined material whose reuse terms
    // differ per asset. A route that served any key would turn a storage path
    // into a distribution licence.
    expect(route).toContain('const SERVABLE_PREFIX = "generated/"');
    expect(route).toContain("!objectKey.startsWith(SERVABLE_PREFIX)");
  });

  it("refuses traversal and doubled separators", () => {
    expect(route).toContain('objectKey.includes("..")');
    expect(route).toContain('objectKey.includes("//")');
  });

  it("serves only known image types", () => {
    expect(route).toContain("if (!CONTENT_TYPES[extension]) {");
    // A stored file must never be sniffed into something executable.
    expect(route).toContain('"x-content-type-options": "nosniff"');
  });
});

describe("analytics ingest is bounded", () => {
  const route = read("app/api/analytics/events/route.ts");

  it("validates the body against a closed schema", () => {
    // `.strict()` means an unexpected field is rejected rather than stored.
    expect(route).toContain(".strict()");
  });

  it("caps the body size", () => {
    // Numeric separators are allowed in the literal, so match loosely.
    expect(route).toMatch(/readAdvertisingJson\(request, [\d_]+\)/u);
  });

  it("checks the origin before doing any work", () => {
    const originAt = route.indexOf("validateMutationRequest");
    const parseAt = route.indexOf("analyticsInput.safeParse");
    expect(originAt).toBeGreaterThan(-1);
    expect(originAt).toBeLessThan(parseAt);
  });

  it("stores an HMAC of the reader identifier, never the identifier", () => {
    expect(route).toContain("hmacSha256Base64Url(secret, parsed.data.anonymousId)");
    expect(route).toContain("anonymousIdHash");
  });
});

describe("error responses stay opaque", () => {
  const api = read("lib/security/api.ts");

  it("never caches an error", () => {
    expect(api).toContain('responseHeaders.set("cache-control", "no-store")');
  });
});

describe("newsroom write paths are protected", () => {
  const route = read("app/api/newsroom/articles/[articleId]/route.ts");

  it("authorises before it mutates", () => {
    const authAt = route.indexOf("authorizeEditorialRequest");
    const mutateAt = route.indexOf("saveArticleDraftVersion(");
    expect(authAt).toBeGreaterThan(-1);
    expect(authAt).toBeLessThan(mutateAt);
  });

  it("requires CSRF protection on every mutation", () => {
    expect(route).toContain("protectEditorialMutation(request, access.user)");
  });

  it("answers 404 for an article outside the caller's scope", () => {
    // Returning 403 would confirm the article exists to someone who may not
    // know that.
    expect(route).toContain("const owned = await readEditorialArticle(");
    expect(route).toContain("if (!owned) return notFound();");
  });
});
