import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  const request = new Request(`http://localhost${path}`, {
      headers: { accept: "text/html", ...(init.headers ?? {}) },
      ...init,
    });
  if (init.cf) {
    Object.defineProperty(request, "cf", {
      value: init.cf,
      configurable: true,
    });
  }

  return worker.fetch(
    request,
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      DB: {
        prepare() {
          throw new Error("D1 is not exercised by read-only render tests.");
        },
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Northline homepage with explicit demo labeling", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Northline — US news, traced to the source<\/title>/i);
  assert.match(html, /id="river-title">Latest</);
  assert.match(html, /id="trend-title">Trending</);
  assert.match(html, /Fictional stories and demo newsroom data/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /name="robots" content="noindex, nofollow"/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /data-vinext-fonts|[a-z]:[\\/](?:users|home)[\\/]/i);
});

test("renders core public routes with distinct product surfaces", async () => {
  const routes = [
    ["/latest", /Everything Northline published, newest first/i],
    ["/trending", /US trend radar/i],
    ["/story/neighborhood-batteries-heat-grid", /In short/i],
    ["/live/neighborhood-batteries-heat-grid", /Coverage is active/i],
    ["/newsletter", /Choose your briefings/i],
    ["/sources", /Browse Northline.*demo sources directory/i],
    ["/sources/demo-grid-bulletin", /Demo operating bulletin and hourly readings/i],
    ["/editorial-standards", /Evidence before speed/i],
  ];

  for (const [path, expected] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), expected, path);
  }

  const story = await render("/story/neighborhood-batteries-heat-grid");
  assert.match(
    await story.text(),
    /rel="canonical" href="https?:\/\/localhost(?::3000)?\/story\/neighborhood-batteries-heat-grid"/,
  );

  const wrongCategory = await render(
    "/news/technology/neighborhood-batteries-heat-grid",
  );
  assert.equal(wrongCategory.status, 404);
});

test("protects newsroom pages before rendering editorial data", async () => {
  const response = await render("/newsroom");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /PROTECTED EDITORIAL WORKSPACE/);
  assert.match(html, /Sign in to open Newsroom OS/);
  assert.doesNotMatch(html, /Candidate queue/);
});

test("keeps the development accessibility harness unavailable in preview", async () => {
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = "preview";

  try {
    const response = await render("/dev-audit/accessibility");
    assert.equal(response.status, 404);
  } finally {
    if (previous === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previous;
    }
  }
});

test("enforces granular newsroom desk permissions server-side", async () => {
  const authKeys = [
    "APP_ENV",
    "AUTH_ROLE_ASSIGNMENTS",
    "AUTH_PROVIDER",
    "AUTH_TRUSTED_PROXY_MODE",
    "AUTH_TRUSTED_PROXY_PLATFORM",
    "AUTH_TRUSTED_PROXY_SECRET",
    "NEXT_PUBLIC_SITE_URL",
  ];
  const previous = Object.fromEntries(
    authKeys.map((key) => [key, process.env[key]]),
  );
  process.env.AUTH_ROLE_ASSIGNMENTS =
    "ads@example.com=Advertising Manager,writer@example.com=Writer,owner@example.com=Owner";
  process.env.APP_ENV = "test";
  process.env.AUTH_PROVIDER = "trusted_proxy";
  process.env.AUTH_TRUSTED_PROXY_MODE = "true";
  process.env.AUTH_TRUSTED_PROXY_PLATFORM = "sites";
  process.env.AUTH_TRUSTED_PROXY_SECRET =
    "rendered-trusted-proxy-test-secret-with-32-characters";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost";

  try {
    const forgedOwner = await render("/newsroom/review", {
      headers: { "oai-authenticated-user-email": "owner@example.com" },
    });
    const forgedOwnerHtml = await forgedOwner.text();
    assert.match(forgedOwnerHtml, /PROTECTED EDITORIAL WORKSPACE/);
    assert.doesNotMatch(forgedOwnerHtml, /FINAL REVIEW/);

    const adEditor = await render("/newsroom/editor", {
      headers: { "oai-authenticated-user-email": "ads@example.com" },
      cf: { colo: "TEST" },
    });
    const adEditorHtml = await adEditor.text();
    assert.match(adEditorHtml, /PERMISSION DENIED/);
    assert.doesNotMatch(adEditorHtml, /Editorial Copilot/);

    const writerReview = await render("/newsroom/review", {
      headers: { "oai-authenticated-user-email": "writer@example.com" },
      cf: { colo: "TEST" },
    });
    const writerReviewHtml = await writerReview.text();
    assert.match(writerReviewHtml, /PERMISSION DENIED/);
    assert.doesNotMatch(writerReviewHtml, /FINAL REVIEW/);

    const ownerReview = await render("/newsroom/review", {
      headers: { "oai-authenticated-user-email": "owner@example.com" },
      cf: { colo: "TEST" },
    });
    assert.match(await ownerReview.text(), /FINAL REVIEW/);

    const writerIntelligence = await render("/newsroom/intelligence", {
      headers: { "oai-authenticated-user-email": "writer@example.com" },
      cf: { colo: "TEST" },
    });
    const writerIntelligenceHtml = await writerIntelligence.text();
    assert.match(writerIntelligenceHtml, /PERMISSION DENIED/);
    assert.doesNotMatch(writerIntelligenceHtml, /High-Signal Article Sample/);

    const ownerIntelligence = await render("/newsroom/intelligence", {
      headers: { "oai-authenticated-user-email": "owner@example.com" },
      cf: { colo: "TEST" },
    });
    const ownerIntelligenceHtml = await ownerIntelligence.text();
    assert.match(ownerIntelligenceHtml, /Intelligence overview/);
    assert.match(ownerIntelligenceHtml, /High-Signal Article Sample/);
    assert.match(ownerIntelligenceHtml, /Relative search interest/);
  } finally {
    for (const key of authKeys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
});

test("returns a real not-found response for unknown routes", async () => {
  for (const path of [
    "/does-not-exist",
    "/story/not-real",
    "/live/not-real",
    "/video/not-real",
    "/story/neighborhood-batteries-heat-grid/anything",
    "/about/anything",
    "/saved/anything",
    "/topics/definitely-not-real",
    "/authors/anything",
  ]) {
    const response = await render(path);
    assert.equal(response.status, 404, path);
    assert.match(await response.text(), /We could not trace that page/, path);
  }
});

test("returns an explicit gone response and applies baseline security headers", async () => {
  const response = await render("/410");
  assert.equal(response.status, 410);
  assert.match(await response.text(), /This story is no longer available/);

  const homepage = await render("/");
  const contentSecurityPolicy =
    homepage.headers.get("content-security-policy") ?? "";
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  const scriptSourceDirective =
    contentSecurityPolicy
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src ")) ?? "";
  assert.doesNotMatch(scriptSourceDirective, /'unsafe-inline'/);
  const nonceMatch = contentSecurityPolicy.match(/'nonce-([^']+)'/);
  assert.ok(nonceMatch, "CSP should contain a per-request nonce");
  assert.match(
    await homepage.text(),
    new RegExp(`<script[^>]+nonce="${nonceMatch[1]}"`),
  );
  assert.equal(homepage.headers.get("x-content-type-options"), "nosniff");
  assert.equal(homepage.headers.get("x-frame-options"), "DENY");
  assert.match(
    homepage.headers.get("strict-transport-security") ?? "",
    /max-age=31536000/,
  );
});

test("serves an XML sitemap index and health response", async () => {
  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") ?? "", /application\/xml/);
  assert.match(await sitemap.text(), /<sitemapindex/);

  const newsSitemap = await render("/news-sitemap.xml");
  const newsXml = await newsSitemap.text();
  assert.equal(newsSitemap.status, 200);
  assert.doesNotMatch(newsXml, /<news:news>/);

  for (const path of ["/sitemaps/pages.xml", "/sitemaps/images.xml"]) {
    const previewSitemap = await render(path);
    assert.equal(previewSitemap.status, 200);
    assert.doesNotMatch(await previewSitemap.text(), /<url>/);
  }

  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Disallow: \//);

  const health = await render("/api/health", {
    headers: { accept: "application/json" },
  });
  assert.equal(health.status, 200);
  assert.deepEqual((await health.json()).status, "ok");
});
