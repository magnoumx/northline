import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const executors = readFileSync(
  fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
  "utf8",
);
const flat = executors.replace(/\s+/gu, " ");
const sweep = flat.slice(
  flat.indexOf("async function retireStaleReviewBacklog"),
  flat.indexOf("export async function executeApprovedArticleAutopublish"),
);

describe("stale review backlog", () => {
  it("retires to REJECTED_EARLY, the only state a never-published draft can enter", () => {
    // The state machine also offers ARCHIVED, but the database trigger
    // `articles_public_update_requires_frozen_version` demands a timestamped
    // frozen version for it - so archiving an unpublished draft aborts. That
    // mismatch is why nothing was clearing this queue.
    expect(sweep).toContain("state = 'REJECTED_EARLY'");
    expect(sweep).not.toContain("state = 'ARCHIVED'");
  });

  it("touches only HUMAN_REVIEW_REQUIRED and DRAFTING, never a published state", () => {
    // DRAFTING is swept too: it is the fixed state every article is created in,
    // and a run that throws before advancing it leaves the row there forever -
    // three articles sat in DRAFTING for six to eight days with nothing left
    // running to finish them.
    const conditions =
      sweep.match(/state IN \('HUMAN_REVIEW_REQUIRED', 'DRAFTING'\)/gu) ?? [];
    expect(conditions.length).toBe(2);
    expect(sweep).not.toContain("'PUBLISHED'");
  });

  it("defaults to 72 hours and stays within sane bounds", () => {
    expect(sweep).toContain("REVIEW_BACKLOG_MAX_AGE_HOURS");
    // boundedInteger(value, minimum, maximum, fallback)
    expect(sweep).toContain("6, 24 * 14, 72,");
  });

  it("records what it retired rather than clearing the queue silently", () => {
    expect(sweep).toContain('"review_backlog_retired"');
    expect(sweep).toContain("articles: stale.results.length");
  });

  it("does nothing, and writes nothing, when the backlog is clean", () => {
    expect(sweep).toContain("if (stale.results.length === 0) return;");
    const guard = sweep.indexOf("if (stale.results.length === 0) return;");
    const update = sweep.indexOf("UPDATE articles");
    expect(guard).toBeLessThan(update);
  });

  it("runs before publishing, so a stale draft cannot be picked up", () => {
    const sweepCall = flat.indexOf("await retireStaleReviewBacklog(db, environment);");
    const publish = flat.indexOf("await publishApprovedArticle(");
    expect(sweepCall).toBeGreaterThan(-1);
    expect(sweepCall).toBeLessThan(publish);
  });
});
