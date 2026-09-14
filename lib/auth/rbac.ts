import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import {
  permissions as permissionRecords,
  rolePermissions,
  roles as roleRecords,
  userRoles,
} from "../../db/schema-v2";
import type { ChatGPTUser } from "../../app/chatgpt-auth";
import {
  authorizeAnyEmail,
  isRole,
  permissions as knownPermissions,
  permissionsForRole,
  roleForEmail,
  type Permission,
  type Role,
} from "./permissions";

type NorthlineDb = Awaited<ReturnType<typeof getDb>>;

export type RbacEnvironment = {
  APP_ENV?: string;
  AUTH_PROVIDER?: string;
  AUTH_ROLE_ASSIGNMENTS?: string;
  AUTH_TRUSTED_PROXY_MODE?: string;
  AUTH_TRUSTED_PROXY_PLATFORM?: string;
};

export type RbacPrincipal = {
  userId: string;
  email: string;
  status: string;
};

export type RbacGrant = {
  roleKey: string;
  roleName: string;
  roleScope: string;
  organizationId: string | null;
  permissionKey: string;
};

export interface RbacRepository {
  findPrincipal(
    identity: Pick<ChatGPTUser, "userId" | "email" | "provider">,
  ): Promise<RbacPrincipal | null>;
  listGrants(userId: string): Promise<readonly RbacGrant[]>;
}

export type StaffAuthorization =
  | {
      allowed: true;
      source: "database" | "trusted_preview";
      principal: RbacPrincipal;
      role: Role;
      roles: readonly Role[];
      permissions: readonly Permission[];
    }
  | {
      allowed: false;
      reason:
        | "identity_not_registered"
        | "inactive"
        | "missing_permission"
        | "misconfigured_role"
        | "storage_unavailable";
    };

export type DatabasePermissionAuthorization =
  | {
      allowed: true;
      principal: RbacPrincipal;
      roleKeys: readonly string[];
    }
  | {
      allowed: false;
      reason:
        | "identity_not_registered"
        | "inactive"
        | "missing_permission"
        | "storage_unavailable";
    };

export function createD1RbacRepository(db: NorthlineDb): RbacRepository {
  return {
    async findPrincipal(identity) {
      const normalizedEmail = identity.email.trim().toLowerCase();
      const candidates = await db
        .select({
          userId: users.id,
          email: users.email,
          status: users.status,
        })
        .from(users)
        .where(
          identity.provider === "standard"
            ? and(
                eq(users.id, identity.userId),
                sql`lower(${users.email}) = ${normalizedEmail}`,
              )
            : sql`lower(${users.email}) = ${normalizedEmail}`,
        )
        .limit(identity.provider === "standard" ? 1 : 2);
      if (
        identity.provider !== "standard" &&
        candidates.length !== 1
      ) {
        return null;
      }
      const selected = candidates[0];
      return selected
        ? {
            ...selected,
            email: selected.email.trim().toLowerCase(),
          }
        : null;
    },

    async listGrants(userId) {
      return db
        .select({
          roleKey: roleRecords.key,
          roleName: roleRecords.name,
          roleScope: roleRecords.scope,
          organizationId: userRoles.organizationId,
          permissionKey: permissionRecords.key,
        })
        .from(userRoles)
        .innerJoin(roleRecords, eq(userRoles.roleId, roleRecords.id))
        .innerJoin(
          rolePermissions,
          eq(rolePermissions.roleId, roleRecords.id),
        )
        .innerJoin(
          permissionRecords,
          eq(rolePermissions.permissionId, permissionRecords.id),
        )
        .where(
          and(
            eq(userRoles.userId, userId),
            isNull(userRoles.revokedAt),
          ),
        );
    },
  };
}

/**
 * Resolves staff permissions from database role grants. Environment role
 * assignments are deliberately limited to attested Sites identities in test
 * or preview when no database identity can be resolved; they can never revive
 * an inactive or explicitly underprivileged database account.
 */
export async function authorizeStaffIdentity(
  identity: ChatGPTUser,
  required: readonly Permission[],
  {
    repository,
    environment = process.env as RbacEnvironment,
    mode = "any",
  }: {
    repository?: RbacRepository;
    environment?: RbacEnvironment;
    mode?: "any" | "all";
  } = {},
): Promise<StaffAuthorization> {
  let resolvedRepository = repository;
  if (!resolvedRepository) {
    try {
      resolvedRepository = createD1RbacRepository(await getDb());
    } catch {
      return (
        trustedPreviewAuthorization(identity, required, environment, mode) ?? {
          allowed: false,
          reason: "storage_unavailable",
        }
      );
    }
  }

  let principal: RbacPrincipal | null;
  try {
    principal = await resolvedRepository.findPrincipal(identity);
  } catch {
    return (
      trustedPreviewAuthorization(identity, required, environment, mode) ?? {
        allowed: false,
        reason: "storage_unavailable",
      }
    );
  }
  if (!principal) {
    return (
      trustedPreviewAuthorization(identity, required, environment, mode) ?? {
        allowed: false,
        reason: "identity_not_registered",
      }
    );
  }
  if (principal.status.trim().toLowerCase() !== "active") {
    return { allowed: false, reason: "inactive" };
  }

  let grants: readonly RbacGrant[];
  try {
    grants = await resolvedRepository.listGrants(principal.userId);
  } catch {
    return { allowed: false, reason: "storage_unavailable" };
  }
  const staffGrants = grants.filter(
    (grant) =>
      grant.organizationId === null &&
      (grant.roleScope === "STAFF" || grant.roleScope === "GLOBAL"),
  );
  const permissionKeys = new Set(
    staffGrants.map((grant) => grant.permissionKey),
  );
  const allowed =
    required.length > 0 &&
    (mode === "all"
      ? required.every(
          (permission) =>
            permissionKeys.has("*") || permissionKeys.has(permission),
        )
      : required.some(
          (permission) =>
            permissionKeys.has("*") || permissionKeys.has(permission),
        ));
  if (!allowed) return { allowed: false, reason: "missing_permission" };

  const recognizedRoles = knownRoleOrder(staffGrants);
  const primaryRole = recognizedRoles[0];
  if (!primaryRole) return { allowed: false, reason: "misconfigured_role" };

  return {
    allowed: true,
    source: "database",
    principal,
    role: primaryRole,
    roles: recognizedRoles,
    permissions: knownPermissions.filter(
      (permission) =>
        permissionKeys.has("*") || permissionKeys.has(permission),
    ),
  };
}

export async function authorizeDatabasePermission(
  identity: Pick<ChatGPTUser, "userId" | "email" | "provider">,
  permissionKey: string,
  {
    repository,
  }: {
    repository: RbacRepository;
  },
): Promise<DatabasePermissionAuthorization> {
  if (
    !/^[a-z][a-z0-9._:-]{2,127}$/.test(permissionKey) ||
    permissionKey.includes("..")
  ) {
    return { allowed: false, reason: "missing_permission" };
  }
  let principal: RbacPrincipal | null;
  let grants: readonly RbacGrant[];
  try {
    principal = await repository.findPrincipal(identity);
    if (!principal) {
      return { allowed: false, reason: "identity_not_registered" };
    }
    if (principal.status.trim().toLowerCase() !== "active") {
      return { allowed: false, reason: "inactive" };
    }
    grants = await repository.listGrants(principal.userId);
  } catch {
    return { allowed: false, reason: "storage_unavailable" };
  }
  const matching = grants.filter(
    (grant) =>
      grant.organizationId === null &&
      (grant.permissionKey === "*" ||
        grant.permissionKey === permissionKey),
  );
  if (matching.length === 0) {
    return { allowed: false, reason: "missing_permission" };
  }
  return {
    allowed: true,
    principal,
    roleKeys: Array.from(new Set(matching.map((grant) => grant.roleKey))),
  };
}

function trustedPreviewAuthorization(
  identity: ChatGPTUser,
  required: readonly Permission[],
  environment: RbacEnvironment,
  mode: "any" | "all",
): Extract<StaffAuthorization, { allowed: true }> | null {
  if (
    (environment.APP_ENV !== "preview" && environment.APP_ENV !== "test") ||
    identity.provider !== "trusted_proxy" ||
    environment.AUTH_PROVIDER !== "trusted_proxy" ||
    environment.AUTH_TRUSTED_PROXY_MODE !== "true" ||
    environment.AUTH_TRUSTED_PROXY_PLATFORM !== "sites"
  ) {
    return null;
  }
  const role = roleForEmail(identity.email, environment.AUTH_ROLE_ASSIGNMENTS);
  if (!role) return null;
  const allowed =
    mode === "all"
      ? required.every((permission) =>
          permissionsForRole(role).includes(permission),
        )
      : authorizeAnyEmail(
          identity.email,
          required,
          environment.AUTH_ROLE_ASSIGNMENTS,
        ).allowed;
  if (!allowed) return null;
  return {
    allowed: true,
    source: "trusted_preview",
    principal: {
      userId: identity.userId,
      email: identity.email,
      status: "preview",
    },
    role,
    roles: [role],
    permissions: permissionsForRole(role),
  };
}

function knownRoleOrder(grants: readonly RbacGrant[]): Role[] {
  const granted = new Set<Role>();
  for (const grant of grants) {
    if (isRole(grant.roleName)) granted.add(grant.roleName);
    if (isRole(grant.roleKey)) granted.add(grant.roleKey);
  }
  return [
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
  ].filter((role): role is Role => granted.has(role as Role));
}
