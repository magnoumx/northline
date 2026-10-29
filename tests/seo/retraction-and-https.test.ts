import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  httpsRedirectTarget,
  isRetractedPublication,
  retractedStoryResponse,
  storySlugFromPath,
} from "../../lib/site/retraction-response";

const worker = readFileSync(
  fileURLToPath(new URL("../../worker/index.ts", import.meta.url)),
  "utf8",
).replace(/\s+/gu, " ");

describe("http requests move to https", () => {
  // Live on 2026-10-29: http://usnorthline.com/latest answered 200 OK.
  it("redirects the production host", () => {
    expect(httpsRedirectTarget(new URL("http://usnorthline.com/latest?page=2"), "usnorthline.com")).toBe(
      "https://usnorthline.com/latest?page=2",
    );
  });

  it("leaves https, local development and other hosts alone", () => {
    expect(httpsRedirectTarget(new URL("https://usnorthline.com/"), "usnorthline.com")).toBeNull();
    expect(httpsRedirectTarget(new URL("http://localhost:8787/"), "usnorthline.com")).toBeNull();
    expect(httpsRedirectTarget(new URL("http://preview.example.workers.dev/"), "usnorthline.com")).toBeNull();
  });

  it("runs before the app renders anything", () => {
    expect(worker.indexOf("httpsRedirectTarget(url")).toBeLessThan(
      worker.indexOf("await handler.fetch(securedRequest"),
    );
  });
});

describe("retracted stories keep a public notice", () => {
  // All 29 retracted articles had been published and answered the generic 404.
  it("recognises only story paths", () => {
    expect(storySlugFromPath("/story/disney-names-14-new-legends")).toBe("disney-names-14-new-legends");
    expect(storySlugFromPath("/story/a/b")).toBeNull();
    expect(storySlugFromPath("/topics/sports")).toBeNull();
    expect(storySlugFromPath("/story/'; DROP TABLE x")).toBeNull();
  });

  it("only treats once-published retractions as retracted", () => {
    expect(isRetractedPublication({ state: "RETRACTED", publishedAt: 1 })).toBe(true);
    expect(isRetractedPublication({ state: "RETRACTED", publishedAt: null })).toBe(false);
    expect(isRetractedPublication({ state: "REJECTED_EARLY", publishedAt: null })).toBe(false);
    expect(isRetractedPublication({ state: "HUMAN_REVIEW_REQUIRED", publishedAt: null })).toBe(false);
    expect(isRetractedPublication(null)).toBe(false);
  });

  it("answers 410, noindex, and links the corrections record", async () => {
    const response = retractedStoryResponse("North<line>");
    expect(response.status).toBe(410);
    const html = await response.text();
    expect(html).toContain('content="noindex,follow"');
    expect(html).toContain('href="/corrections"');
    expect(html).not.toContain("North<line>");
  });

  it("is consulted only after the app returned 404, with a bound slug", () => {
    expect(worker).toContain("response.status === 404 &&");
    expect(worker).toContain("FROM articles WHERE slug = ?1 LIMIT 1`");
    expect(worker).toContain(".bind(slug)");
    expect(worker.indexOf("isRetractedPublication(row)")).toBeGreaterThan(
      worker.indexOf("await handler.fetch(securedRequest"),
    );
  });
});
