import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EDITORIAL_TRANSITIONS } from "../../lib/editorial/state-machine";

const service = readFileSync(
  fileURLToPath(
    new URL("../../lib/editorial/article-write-service.ts", import.meta.url),
  ),
  "utf8",
);
const route = readFileSync(
  fileURLToPath(
    new URL(
      "../../app/api/newsroom/articles/[articleId]/route.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("taking a story down", () => {
  it("is a state change, never a delete", () => {
    // Published versions are frozen by database triggers and the audit trail is
    // append-only. Removing rows would destroy the record of what was published,
    // which is exactly what a corrections policy exists to preserve.
    const start = service.indexOf("export async function withdrawArticle");
    const body = service.slice(start, start + 3200);
    expect(body).not.toMatch(/DELETE FROM/u);
    expect(body).toContain("UPDATE articles SET state");
    expect(body).toContain("conditionalAuditInsert");
    expect(body).toContain("conditionalTransitionInsert");
  });

  it("only allows a move the state machine already permits", () => {
    expect(EDITORIAL_TRANSITIONS.PUBLISHED).toContain("ARCHIVED");
    expect(EDITORIAL_TRANSITIONS.PUBLISHED).toContain("RETRACTED");
    expect(service).toContain("EDITORIAL_TRANSITIONS[");
  });

  it("demands a reason for a retraction", () => {
    // Archiving is quiet housekeeping; a retraction is an on-the-record
    // statement that a story should not have run.
    expect(service).toContain('input.state === "RETRACTED"');
    expect(service).toContain("A retraction has to state why");
  });

  it("treats withdrawal as a publishing permission", () => {
    expect(route).toContain(
      'if (action === "archive" || action === "retract") return ["article.publish"];',
    );
  });

  it("is reachable from the newsroom, not only from SQL", () => {
    expect(route).toContain('action !== "archive"');
    expect(route).toContain('action !== "retract"');
    expect(route).toContain("withdrawArticle(");
  });
});
