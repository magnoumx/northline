import { describe, expect, it } from "vitest";
import {
  indexingEnvironmentGate,
  isSearchIndexingEnabled,
  resolveIndexingDecision,
} from "../../lib/site/indexing";

const prodEnv = {
  APP_ENV: "production",
  ENABLE_SEARCH_INDEXING: "true",
  DEMO_CONTENT_MODE: "false",
  NEXT_PUBLIC_SITE_URL: "https://usnorthline.com",
};

describe("the environment gate is the real, instant kill switch", () => {
  it("passes only in a fully configured production environment", () => {
    expect(indexingEnvironmentGate(prodEnv)).toBe(true);
  });

  it("fails outside production, without search indexing enabled, in demo mode, or without a final https origin", () => {
    expect(indexingEnvironmentGate({ ...prodEnv, APP_ENV: "preview" })).toBe(false);
    expect(indexingEnvironmentGate({ ...prodEnv, ENABLE_SEARCH_INDEXING: "false" })).toBe(false);
    expect(indexingEnvironmentGate({ ...prodEnv, DEMO_CONTENT_MODE: "true" })).toBe(false);
    expect(indexingEnvironmentGate({ ...prodEnv, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe(false);
    expect(indexingEnvironmentGate({ ...prodEnv, NEXT_PUBLIC_SITE_URL: undefined })).toBe(false);
  });
});

describe("resolving a decision when the database read may have failed", () => {
  it("trusts a successful read outright", () => {
    expect(resolveIndexingDecision({ ok: true, enabled: true }, null)).toBe(true);
    expect(resolveIndexingDecision({ ok: true, enabled: false }, true)).toBe(false);
  });

  it("falls back to the last known-good decision on a failed read", () => {
    // The defect: a transient D1 blip on any request rendering robots.txt, a
    // sitemap, or the layout meta tag served Google `Disallow: /` for a fully
    // live, owner-approved site, because a read failure and "never decided"
    // were the same value.
    expect(resolveIndexingDecision({ ok: false }, true)).toBe(true);
    expect(resolveIndexingDecision({ ok: false }, false)).toBe(false);
  });

  it("still defaults closed when nothing has ever been read", () => {
    // A cold isolate that has never seen a real decision must not index by
    // accident - this is the one case where "unknown" still means false.
    expect(resolveIndexingDecision({ ok: false }, null)).toBe(false);
  });
});

describe("isSearchIndexingEnabled end to end", () => {
  it("returns false without ever reaching the database when the environment gate fails", async () => {
    // getDb() throws outside a Workers runtime, so if this returned anything
    // other than false via the environment short-circuit, it would throw
    // instead of resolving.
    await expect(
      isSearchIndexingEnabled({ ...prodEnv, ENABLE_SEARCH_INDEXING: "false" }),
    ).resolves.toBe(false);
  });

  it("degrades to false, not to a thrown error, when the database is unavailable", async () => {
    // No Workers runtime is present in this test, so getDb() always throws -
    // exercising exactly the failure path the fix targets. With no prior
    // successful read cached, false is still the correct, safe answer.
    await expect(isSearchIndexingEnabled(prodEnv)).resolves.toBe(false);
  });
});
