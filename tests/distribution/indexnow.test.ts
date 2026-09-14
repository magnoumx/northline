import { describe, expect, it, vi } from "vitest";
import {
  isValidIndexNowKey,
  MAXIMUM_URLS_PER_SUBMISSION,
  planIndexNowSubmission,
  submitToIndexNow,
} from "../../lib/distribution/indexnow";

const key = "cf99a9366e694351a52566136f71b66e";
const siteUrl = "https://usnorthline.com";

describe("key validation", () => {
  it("accepts the issued key", () => {
    expect(isValidIndexNowKey(key)).toBe(true);
  });

  it("rejects anything that is not hexadecimal or is too short", () => {
    for (const value of ["", "short", "not-hex-at-all-zzzz", "1234567"]) {
      expect(isValidIndexNowKey(value), value).toBe(false);
    }
  });
});

describe("submission planning", () => {
  it("builds a submission with the key file location", () => {
    const plan = planIndexNowSubmission({
      urls: [`${siteUrl}/story/a`, `${siteUrl}/story/b`],
      siteUrl,
      key,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.submission.host).toBe("usnorthline.com");
    expect(plan.submission.keyLocation).toBe(`${siteUrl}/${key}.txt`);
    expect(plan.submission.urlList).toHaveLength(2);
  });

  it("refuses a URL on a host we do not control", () => {
    // Submitting someone else's URL is how a key gets revoked.
    const plan = planIndexNowSubmission({
      urls: [`${siteUrl}/story/a`, "https://example.com/story/b"],
      siteUrl,
      key,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusal.reason).toBe("foreign_host");
  });

  it("drops a malformed URL rather than submitting it", () => {
    const plan = planIndexNowSubmission({
      urls: [`${siteUrl}/story/a`, "not a url"],
      siteUrl,
      key,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.submission.urlList).toEqual([`${siteUrl}/story/a`]);
  });

  it("de-duplicates so one change is announced once", () => {
    const plan = planIndexNowSubmission({
      urls: [`${siteUrl}/story/a`, `${siteUrl}/story/a`],
      siteUrl,
      key,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.submission.urlList).toHaveLength(1);
  });

  it("refuses when nothing changed", () => {
    const plan = planIndexNowSubmission({ urls: [], siteUrl, key });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusal.reason).toBe("no_urls");
  });

  it("refuses an unconfigured or invalid key", () => {
    for (const candidate of [undefined, "", "nonsense"]) {
      const plan = planIndexNowSubmission({
        urls: [`${siteUrl}/story/a`],
        siteUrl,
        key: candidate,
      });
      expect(plan.ok, String(candidate)).toBe(false);
      if (plan.ok) return;
      expect(plan.refusal.reason).toBe("not_configured");
    }
  });

  it("respects the protocol's batch limit", () => {
    const plan = planIndexNowSubmission({
      urls: Array.from(
        { length: MAXIMUM_URLS_PER_SUBMISSION + 1 },
        (_, index) => `${siteUrl}/story/${index}`,
      ),
      siteUrl,
      key,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusal.reason).toBe("too_many");
  });
});

describe("submission", () => {
  const submission = {
    host: "usnorthline.com",
    key,
    keyLocation: `${siteUrl}/${key}.txt`,
    urlList: [`${siteUrl}/story/a`],
  };

  it("treats 200 and 202 as accepted", async () => {
    for (const status of [200, 202]) {
      const result = await submitToIndexNow(
        submission,
        (async () => new Response(null, { status })) as unknown as typeof fetch,
      );
      expect(result.ok, String(status)).toBe(true);
    }
  });

  it("explains a 403 as a key-file problem rather than retrying blindly", () => {
    return submitToIndexNow(
      submission,
      (async () => new Response(null, { status: 403 })) as unknown as typeof fetch,
    ).then((result) => {
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.detail).toContain("key file could not be verified");
    });
  });

  it("explains a 422 as a host mismatch", async () => {
    const result = await submitToIndexNow(
      submission,
      (async () => new Response(null, { status: 422 })) as unknown as typeof fetch,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("did not belong to the key's host");
  });

  it("never throws when the endpoint is unreachable", async () => {
    const failing = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await submitToIndexNow(submission, failing);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(0);
  });
});

describe("wired to publication, not to a timer", () => {
  it("announces only URLs that actually published in the run", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const executors = readFileSync(
      fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
      "utf8",
    ).replace(/\s+/gu, " ");

    // Announcing on a schedule is indistinguishable from spam and is how a key
    // gets revoked. The URL is collected only after publishApprovedArticle
    // returned without throwing.
    expect(executors).toContain("const publishedUrls: string[] = [];");
    const push = executors.indexOf("publishedUrls.push(");
    const publish = executors.indexOf("await publishApprovedArticle(");
    expect(publish).toBeGreaterThan(-1);
    expect(push).toBeGreaterThan(publish);
    expect(executors).toContain(
      "await announceToIndexNow(db, environment, publishedUrls);",
    );
  });

  it("records the outcome so a revoked key is visible", () => {
    return import("node:fs").then(async ({ readFileSync }) => {
      const { fileURLToPath } = await import("node:url");
      const executors = readFileSync(
        fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
        "utf8",
      );
      expect(executors).toContain('"distribution.indexnow"');
      expect(executors).toContain('result.ok ? "submitted" : "rejected"');
    });
  });
});

describe("the key file", () => {
  it("is answered by the Worker, ahead of the catch-all route", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const worker = readFileSync(
      fileURLToPath(new URL("../../worker/index.ts", import.meta.url)),
      "utf8",
    );
    // The app router's catch-all claims every path, so a route file returned
    // the styled 404 page and ownership verification failed.
    expect(worker).toContain("url.pathname === `/${indexNowKey}.txt`");
    expect(worker).toContain('"content-type": "text/plain; charset=utf-8"');
    // Only the configured key is served; any other name falls through to 404.
    expect(worker).toContain("stringBinding(runtimeEnvironment.INDEXNOW_KEY)");
  });
});
