export const roles = [
  "Owner",
  "Administrator",
  "Editor-in-Chief",
  "Managing Editor",
  "News Editor",
  "Section Editor",
  "Writer",
  "Fact Checker",
  "Copy Editor",
  "SEO Editor",
  "Media Editor",
  "Legal Reviewer",
  "Advertising Manager",
  "Analyst",
  "Developer",
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "workspace.access",
  "article.create",
  "article.edit.own",
  "article.edit.any",
  "article.approve",
  "article.publish",
  "article.correct",
  "article.retract",
  "source.manage",
  "trend.manage",
  "media.approve",
  "newsletter.manage",
  "ad.manage",
  "user.manage",
  "settings.manage",
  "audit.view",
  // Autonomous operations are separated from settings and audit because each
  // one spends money, loads the queue, or touches publication. Reading audit
  // history must never imply the authority to start them.
  "automation.autodraft.run",
  "automation.autopublish.run",
  "automation.audio.run",
  "automation.internal_links.run",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, ReadonlySet<Permission | "*">> = {
  Owner: new Set(["*"]),
  Administrator: new Set(["*"]),
  "Editor-in-Chief": new Set([
    "workspace.access",
    "article.create",
    "article.edit.any",
    "article.approve",
    "article.publish",
    "article.correct",
    "article.retract",
    "source.manage",
    "trend.manage",
    "media.approve",
    "newsletter.manage",
    "audit.view",
    "automation.autodraft.run",
    "automation.autopublish.run",
    "automation.audio.run",
    "automation.internal_links.run",
  ]),
  "Managing Editor": new Set([
    "workspace.access",
    "article.create",
    "article.edit.any",
    "article.approve",
    "article.publish",
    "article.correct",
    "source.manage",
    "trend.manage",
    "newsletter.manage",
    "audit.view",
    "automation.autodraft.run",
    "automation.audio.run",
    "automation.internal_links.run",
  ]),
  "News Editor": new Set([
    "workspace.access",
    "article.create",
    "article.edit.any",
    "article.approve",
    "trend.manage",
    "newsletter.manage",
    "audit.view",
    "automation.autodraft.run",
  ]),
  "Section Editor": new Set([
    "workspace.access",
    "article.create",
    "article.edit.any",
    "article.approve",
    "trend.manage",
  ]),
  Writer: new Set([
    "workspace.access",
    "article.create",
    "article.edit.own",
  ]),
  "Fact Checker": new Set([
    "workspace.access",
    "article.edit.any",
    "audit.view",
  ]),
  "Copy Editor": new Set(["workspace.access", "article.edit.any"]),
  "SEO Editor": new Set(["workspace.access", "article.edit.any"]),
  "Media Editor": new Set([
    "workspace.access",
    "article.edit.any",
    "media.approve",
  ]),
  "Legal Reviewer": new Set([
    "workspace.access",
    "article.edit.any",
    "article.approve",
    "audit.view",
  ]),
  "Advertising Manager": new Set(["workspace.access", "ad.manage"]),
  Analyst: new Set(["workspace.access", "audit.view"]),
  Developer: new Set([
    "workspace.access",
    "settings.manage",
    "audit.view",
    "automation.audio.run",
    "automation.internal_links.run",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const grants = rolePermissions[role];
  return grants.has("*") || grants.has(permission);
}

export function hasAnyPermission(
  role: Role,
  required: readonly Permission[],
): boolean {
  return required.some((permission) => hasPermission(role, permission));
}

export function permissionsForRole(role: Role): readonly Permission[] {
  return permissions.filter((permission) => hasPermission(role, permission));
}

/**
 * Compatibility parser for the attested Sites test/preview bootstrap adapter.
 * Production authorization must use the database-backed RBAC service.
 */
export function parseRoleAssignments(value: string | undefined): Map<string, Role> {
  const assignments = new Map<string, Role>();
  if (!value) return assignments;

  for (const entry of value.split(",")) {
    const splitAt = entry.lastIndexOf("=");
    if (splitAt <= 0) continue;
    const email = entry.slice(0, splitAt).trim().toLowerCase();
    const requestedRole = entry.slice(splitAt + 1).trim();
    if (!email || !isRole(requestedRole)) continue;
    assignments.set(email, requestedRole);
  }
  return assignments;
}

export function roleForEmail(
  email: string,
  assignments: string | undefined,
): Role | null {
  return parseRoleAssignments(assignments).get(email.trim().toLowerCase()) ?? null;
}

export function authorizeEmail(
  email: string,
  permission: Permission,
  assignments: string | undefined,
): { allowed: true; role: Role } | { allowed: false; role: null } {
  const role = roleForEmail(email, assignments);
  if (!role || !hasPermission(role, permission)) {
    return { allowed: false, role: null };
  }
  return { allowed: true, role };
}

export function authorizeAnyEmail(
  email: string,
  required: readonly Permission[],
  assignments: string | undefined,
): { allowed: true; role: Role } | { allowed: false; role: null } {
  const role = roleForEmail(email, assignments);
  if (!role || !hasAnyPermission(role, required)) {
    return { allowed: false, role: null };
  }
  return { allowed: true, role };
}

export function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value);
}
