import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const worker = readFileSync(
  fileURLToPath(new URL("../../worker/index.ts", import.meta.url)),
  "utf8",
).replace(/\s+/gu, " ");

describe("public page caching", () => {
  it("keeps private surfaces uncacheable", () => {
    // Newsroom, API and account responses are per-identity and must never be
    // stored in a shared cache.
    expect(worker).toContain('url.pathname.startsWith("/newsroom")');
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('url.pathname.startsWith("/account")');
    expect(worker).toContain(
      'return withCacheControl(response, "private, no-store");',
    );
  });

  it("allows a shared cache for public reader pages", () => {
    // Every public page was served no-store, so nothing was cached at the edge
    // and every visit re-rendered and re-queried D1.
    expect(worker).toContain(
      '"public, s-maxage=60, stale-while-revalidate=86400"',
    );
  });

  it("serves a stale copy rather than making the reader wait on the origin", () => {
    // With a 300-second revalidation window the edge ran out of anything to
    // serve and every later request waited on the origin and D1 - measured TTFB
    // was 0.78-0.93s. The window has to be wide enough that a low-traffic
    // archive still answers from cache.
    const match = /stale-while-revalidate=(\d+)/u.exec(worker);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(3600);
  });

  it("never shares a response that carries a cookie", () => {
    expect(worker).toContain('!response.headers.has("set-cookie")');
  });

  it("only caches successful HTML GETs", () => {
    expect(worker).toContain(
      '(request.method === "GET" || request.method === "HEAD")',
    );
    expect(worker).toContain("response.status === 200");
    expect(worker).toContain('.includes("text/html")');
  });

  it("keeps the window short enough for a correction to propagate", () => {
    const match = /s-maxage=(\d+)/u.exec(worker);
    expect(match).not.toBeNull();
    // A correction has to reach readers quickly; this is a news site, not a blog.
    expect(Number(match?.[1])).toBeLessThanOrEqual(120);
  });
});

describe("header mutation", () => {
  it("copies the response instead of mutating immutable headers", () => {
    // Headers on a response returned by a downstream handler are immutable, so
    // `headers.set` there is silently a no-op - the first attempt at this
    // policy shipped and changed nothing at all.
    expect(worker).toContain("function withCacheControl(");
    expect(worker).toContain("const headers = new Headers(response.headers);");
    expect(worker).toContain("return new Response(response.body, {");
  });
});
