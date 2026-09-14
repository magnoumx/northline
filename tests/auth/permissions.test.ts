import { describe, expect, it } from "vitest";
import {
  authorizeAnyEmail,
  authorizeEmail,
  hasAnyPermission,
  hasPermission,
  parseRoleAssignments,
  roleForEmail,
} from "../../lib/auth/permissions";

describe("newsroom authorization", () => {
  const assignments =
    "owner@example.com=Owner,writer@example.com=Writer,legal@example.com=Legal Reviewer";

  it("parses explicit, case-insensitive email assignments", () => {
    const parsed = parseRoleAssignments(assignments);
    expect(parsed.get("owner@example.com")).toBe("Owner");
    expect(roleForEmail("WRITER@EXAMPLE.COM", assignments)).toBe("Writer");
  });

  it("rejects malformed or unknown roles", () => {
    const parsed = parseRoleAssignments(
      "bad,person@example.com=Superuser,=Owner",
    );
    expect(parsed.size).toBe(0);
  });

  it("grants owners every declared permission", () => {
    expect(hasPermission("Owner", "article.publish")).toBe(true);
    expect(hasPermission("Owner", "settings.manage")).toBe(true);
  });

  it("keeps writer privileges narrow", () => {
    expect(hasPermission("Writer", "workspace.access")).toBe(true);
    expect(hasPermission("Writer", "article.edit.own")).toBe(true);
    expect(hasPermission("Writer", "article.publish")).toBe(false);
    expect(
      hasAnyPermission("Writer", ["article.edit.own", "article.approve"]),
    ).toBe(true);
  });

  it("enforces desk-level any-of permission checks", () => {
    expect(
      authorizeAnyEmail(
        "writer@example.com",
        ["article.create", "article.edit.own", "article.edit.any"],
        assignments,
      ),
    ).toEqual({ allowed: true, role: "Writer" });
    expect(
      authorizeAnyEmail(
        "writer@example.com",
        ["article.approve", "audit.view"],
        assignments,
      ),
    ).toEqual({ allowed: false, role: null });
  });

  it("denies unassigned identities by default", () => {
    expect(
      authorizeEmail("unknown@example.com", "workspace.access", assignments),
    ).toEqual({ allowed: false, role: null });
  });
});
