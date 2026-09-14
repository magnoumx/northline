import { describe, expect, it } from "vitest";
import type { ChatGPTUser } from "../../app/chatgpt-auth";
import {
  authorizeDatabasePermission,
  authorizeStaffIdentity,
  type RbacGrant,
  type RbacPrincipal,
  type RbacRepository,
} from "../../lib/auth/rbac";

const owner: ChatGPTUser = {
  userId: "user_owner_123",
  email: "owner@example.com",
  displayName: "Owner",
  fullName: "Owner",
  provider: "standard",
  sessionId: "session_owner_123",
};

function repository({
  principal = {
    userId: owner.userId,
    email: owner.email,
    status: "active",
  },
  grants = [],
}: {
  principal?: RbacPrincipal | null;
  grants?: readonly RbacGrant[];
} = {}): RbacRepository {
  return {
    async findPrincipal() {
      return principal;
    },
    async listGrants() {
      return grants;
    },
  };
}

function grant(
  permissionKey: string,
  overrides: Partial<RbacGrant> = {},
): RbacGrant {
  return {
    roleKey: "owner",
    roleName: "Owner",
    roleScope: "STAFF",
    organizationId: null,
    permissionKey,
    ...overrides,
  };
}

describe("database-backed newsroom RBAC", () => {
  it("authorizes from active database role and permission grants", async () => {
    const authorization = await authorizeStaffIdentity(
      owner,
      ["workspace.access", "article.publish"],
      {
        repository: repository({
          grants: [grant("workspace.access"), grant("article.publish")],
        }),
        mode: "all",
      },
    );
    expect(authorization).toMatchObject({
      allowed: true,
      source: "database",
      role: "Owner",
      permissions: ["workspace.access", "article.publish"],
    });
  });

  it("ignores organization-scoped grants for the staff workspace", async () => {
    await expect(
      authorizeStaffIdentity(owner, ["workspace.access"], {
        repository: repository({
          grants: [
            grant("workspace.access", {
              organizationId: "org_other_123",
            }),
          ],
        }),
      }),
    ).resolves.toEqual({
      allowed: false,
      reason: "missing_permission",
    });
  });

  it("never lets environment assignments authorize production", async () => {
    const proxyOwner = { ...owner, provider: "trusted_proxy" as const };
    await expect(
      authorizeStaffIdentity(proxyOwner, ["workspace.access"], {
        repository: repository({ principal: null }),
        environment: {
          APP_ENV: "production",
          AUTH_PROVIDER: "trusted_proxy",
          AUTH_TRUSTED_PROXY_MODE: "true",
          AUTH_TRUSTED_PROXY_PLATFORM: "sites",
          AUTH_ROLE_ASSIGNMENTS: "owner@example.com=Owner",
        },
      }),
    ).resolves.toEqual({
      allowed: false,
      reason: "identity_not_registered",
    });
  });

  it("limits bootstrap fallback to attested trusted-proxy preview identities", async () => {
    const authorization = await authorizeStaffIdentity(
      { ...owner, provider: "trusted_proxy" },
      ["workspace.access"],
      {
        repository: repository({ principal: null }),
        environment: {
          APP_ENV: "preview",
          AUTH_PROVIDER: "trusted_proxy",
          AUTH_TRUSTED_PROXY_MODE: "true",
          AUTH_TRUSTED_PROXY_PLATFORM: "sites",
          AUTH_ROLE_ASSIGNMENTS: "owner@example.com=Owner",
        },
      },
    );
    expect(authorization).toMatchObject({
      allowed: true,
      source: "trusted_preview",
      role: "Owner",
    });
  });

  it("does not revive an inactive database account through preview fallback", async () => {
    await expect(
      authorizeStaffIdentity(
        { ...owner, provider: "trusted_proxy" },
        ["workspace.access"],
        {
          repository: repository({
            principal: {
              userId: owner.userId,
              email: owner.email,
              status: "disabled",
            },
          }),
          environment: {
            APP_ENV: "preview",
            AUTH_PROVIDER: "trusted_proxy",
            AUTH_TRUSTED_PROXY_MODE: "true",
            AUTH_TRUSTED_PROXY_PLATFORM: "sites",
            AUTH_ROLE_ASSIGNMENTS: "owner@example.com=Owner",
          },
        },
      ),
    ).resolves.toEqual({ allowed: false, reason: "inactive" });
  });
});

describe("database permissions for advertiser administration", () => {
  it("requires the exact unscoped permission", async () => {
    const denied = await authorizeDatabasePermission(
      owner,
      "advertiser.organization.create",
      {
        repository: repository({
          grants: [
            grant("ad.manage"),
            grant("advertiser.organization.create", {
              organizationId: "org_other_123",
            }),
          ],
        }),
      },
    );
    expect(denied).toEqual({
      allowed: false,
      reason: "missing_permission",
    });

    const allowed = await authorizeDatabasePermission(
      owner,
      "advertiser.organization.create",
      {
        repository: repository({
          grants: [
            grant("advertiser.organization.create", {
              roleScope: "GLOBAL",
            }),
          ],
        }),
      },
    );
    expect(allowed).toMatchObject({
      allowed: true,
      principal: { userId: owner.userId },
    });
  });
});
