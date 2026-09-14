import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

const executors = read("lib/jobs/executors.ts");
const routing = read("lib/jobs/cron-routing.ts");
const handlers = read("lib/jobs/handlers.ts");
const delivery = read("lib/newsletter/delivery.ts");

describe("the newsletter actually has a sender", () => {
  it("is registered on a schedule", () => {
    // The site advertised "weekdays at 7 a.m. ET" with no job, no cron entry
    // and not one delivery log row behind it.
    expect(routing).toContain('"newsletter.issue_send"');
    expect(routing).toContain(
      '["0 0 * * *", ["internal_links.refresh", "newsletter.issue_send", "maintenance.data_hygiene"]]',
    );
    expect(handlers).toContain('"newsletter.issue_send": enabledHandler(');
  });

  it("is gated behind an explicit delivery flag", () => {
    expect(executors).toContain(
      'environment.FEATURE_NEWSLETTER_DELIVERY !== "true"',
    );
  });
});

describe("a subscriber cannot receive the same issue twice", () => {
  it("keys idempotency on the issue and the recipient, not the attempt", () => {
    expect(executors).toContain(
      "`newsletter-issue:${issueId}:${subscriber.id}`",
    );
    // The provider is given the same key, so even a retry in flight is deduped.
    expect(delivery).toContain('"idempotency-key": idempotencyKey');
  });

  it("skips a recipient already logged for this issue", () => {
    const body = executors
      .slice(executors.indexOf("executeNewsletterIssueSend"))
      .replace(/\s+/gu, " ");
    expect(body).toContain("FROM newsletter_delivery_logs WHERE idempotency_key_hash");
    expect(body).toContain("if (existing) continue;");
  });
});

describe("coverage is only retired once it has been delivered", () => {
  it("records sent articles only after a successful send", () => {
    const body = executors
      .slice(executors.indexOf("executeNewsletterIssueSend"))
      .replace(/\s+/gu, " ");
    // Marking articles as sent when nothing went out would retire coverage no
    // subscriber ever received.
    const guard = body.indexOf("if (delivered > 0) {");
    const insert = body.indexOf("INSERT OR IGNORE INTO newsletter_issue_articles");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(insert);
  });

  it("records a failure against the recipient rather than aborting the run", () => {
    const body = executors
      .slice(executors.indexOf("executeNewsletterIssueSend"))
      .replace(/\s+/gu, " ");
    expect(body).toContain("'FAILED', ?5, ?6");
    expect(body).toContain("failed += 1;");
  });
});

describe("suppression is respected", () => {
  it("never mails an address on the suppression list", () => {
    const body = executors
      .slice(executors.indexOf("executeNewsletterIssueSend"))
      .replace(/\s+/gu, " ");
    expect(body).toContain("FROM newsletter_suppressions p WHERE p.email = s.email");
    expect(body).toContain("s.status = 'CONFIRMED'");
  });
});
