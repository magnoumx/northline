import { describe, expect, it } from "vitest";
import type { ChatGPTUser } from "../../app/chatgpt-auth";
import {
  createAdvertiserCampaign,
  createAdvertiserOrganization,
  listAdvertiserCampaigns,
  readAdvertiserOrganization,
  type AdvertiserCampaignView,
  type AdvertiserOrganizationView,
  type AdvertiserTenantStore,
} from "../../lib/auth/advertiser-tenant";
import type {
  RbacGrant,
  RbacPrincipal,
  RbacRepository,
} from "../../lib/auth/rbac";

const alice: ChatGPTUser = {
  userId: "user_alice_123",
  email: "alice@example.com",
  displayName: "Alice",
  fullName: "Alice",
  provider: "standard",
  sessionId: "session_alice_123",
};
const bob: ChatGPTUser = {
  userId: "user_bob_12345",
  email: "bob@example.com",
  displayName: "Bob",
  fullName: "Bob",
  provider: "standard",
  sessionId: "session_bob_12345",
};

const aliceOrganization: AdvertiserOrganizationView = {
  id: "aorg_alice_123",
  organizationId: "org_alice_1234",
  advertiserId: "adv_alice_1234",
  displayName: "Alice Ads",
  legalName: "Alice Advertising LLC",
  organizationName: "Alice Media Team",
  organizationSlug: "alice-media-team",
  role: "OWNER",
};
const bobOrganization: AdvertiserOrganizationView = {
  id: "aorg_bob_12345",
  organizationId: "org_bob_123456",
  advertiserId: "adv_bob_123456",
  displayName: "Bob Ads",
  legalName: "Bob Advertising LLC",
  organizationName: "Bob Media Team",
  organizationSlug: "bob-media-team",
  role: "VIEWER",
};

function rbacRepository(
  grantsByUser: ReadonlyMap<string, readonly RbacGrant[]> = new Map(),
): RbacRepository {
  const principals = new Map<string, RbacPrincipal>([
    [
      alice.userId,
      { userId: alice.userId, email: alice.email, status: "active" },
    ],
    [
      bob.userId,
      { userId: bob.userId, email: bob.email, status: "active" },
    ],
  ]);
  return {
    async findPrincipal(identity) {
      return principals.get(identity.userId) ?? null;
    },
    async listGrants(userId) {
      return grantsByUser.get(userId) ?? [];
    },
  };
}

function tenantStore(): AdvertiserTenantStore {
  const memberships = new Map<string, Map<string, AdvertiserOrganizationView>>([
    [alice.userId, new Map([[aliceOrganization.id, aliceOrganization]])],
    [bob.userId, new Map([[bobOrganization.id, bobOrganization]])],
  ]);
  const campaignRows = new Map<string, AdvertiserCampaignView[]>([
    [
      aliceOrganization.id,
      [
        {
          id: "camp_alice_123",
          advertiserOrganizationId: aliceOrganization.id,
          name: "Alice launch",
          objective: "BRAND_AWARENESS",
          status: "DRAFT",
          startsAt: null,
          endsAt: null,
          createdAt: "2026-07-24T12:00:00.000Z",
        },
      ],
    ],
  ]);
  const organizationClaims = new Map<
    string,
    { requestHash: string; value: AdvertiserOrganizationView }
  >();
  const campaignClaims = new Map<
    string,
    { requestHash: string; value: AdvertiserCampaignView }
  >();

  return {
    async listOrganizations(userId) {
      return Array.from(memberships.get(userId)?.values() ?? []);
    },
    async getOrganization(userId, advertiserOrganizationId) {
      return memberships.get(userId)?.get(advertiserOrganizationId) ?? null;
    },
    async createOrganization({
      actor,
      values,
      idempotencyId,
      requestHash,
    }) {
      const claimed = organizationClaims.get(idempotencyId);
      if (claimed) {
        return claimed.requestHash === requestHash
          ? { outcome: "replayed" as const, value: claimed.value }
          : { outcome: "conflict" as const };
      }
      const value: AdvertiserOrganizationView = {
        id: "aorg_created_123",
        organizationId: "org_created_1234",
        advertiserId: "adv_created_1234",
        displayName: values.displayName,
        legalName: values.legalName,
        organizationName: values.organizationName,
        organizationSlug: values.organizationSlug,
        role: "OWNER",
      };
      organizationClaims.set(idempotencyId, { requestHash, value });
      const actorMemberships =
        memberships.get(actor.userId) ??
        new Map<string, AdvertiserOrganizationView>();
      actorMemberships.set(value.id, value);
      memberships.set(actor.userId, actorMemberships);
      return { outcome: "created" as const, value };
    },
    async listCampaigns(userId, advertiserOrganizationId) {
      if (!memberships.get(userId)?.has(advertiserOrganizationId)) return [];
      return campaignRows.get(advertiserOrganizationId) ?? [];
    },
    async createCampaign({
      values,
      idempotencyId,
      requestHash,
      now,
    }) {
      const claimed = campaignClaims.get(idempotencyId);
      if (claimed) {
        return claimed.requestHash === requestHash
          ? { outcome: "replayed" as const, value: claimed.value }
          : { outcome: "conflict" as const };
      }
      const value: AdvertiserCampaignView = {
        id: "camp_created_123",
        advertiserOrganizationId: values.advertiserOrganizationId,
        name: values.name,
        objective: values.objective,
        status: "DRAFT",
        startsAt: values.startsAt?.toISOString() ?? null,
        endsAt: values.endsAt?.toISOString() ?? null,
        createdAt: now.toISOString(),
      };
      campaignClaims.set(idempotencyId, { requestHash, value });
      campaignRows.set(values.advertiserOrganizationId, [
        ...(campaignRows.get(values.advertiserOrganizationId) ?? []),
        value,
      ]);
      return { outcome: "created" as const, value };
    },
  };
}

describe("advertiser tenant isolation", () => {
  it("returns a uniform not-found result for another tenant's organization", async () => {
    const dependencies = {
      rbac: rbacRepository(),
      store: tenantStore(),
    };
    await expect(
      readAdvertiserOrganization(bob, aliceOrganization.id, dependencies),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    await expect(
      readAdvertiserOrganization(alice, aliceOrganization.id, dependencies),
    ).resolves.toMatchObject({
      ok: true,
      value: { id: aliceOrganization.id, role: "OWNER" },
    });
  });

  it("never lists campaigns through a cross-tenant identifier", async () => {
    const dependencies = {
      rbac: rbacRepository(),
      store: tenantStore(),
    };
    await expect(
      listAdvertiserCampaigns(bob, aliceOrganization.id, dependencies),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    await expect(
      listAdvertiserCampaigns(alice, aliceOrganization.id, dependencies),
    ).resolves.toMatchObject({
      ok: true,
      value: [{ id: "camp_alice_123" }],
    });
  });

  it("keeps viewer membership read-only and permits an owner create", async () => {
    const dependencies = {
      rbac: rbacRepository(),
      store: tenantStore(),
      now: new Date("2026-07-24T12:00:00.000Z"),
    };
    const values = {
      advertiserOrganizationId: bobOrganization.id,
      name: "Autumn launch",
      objective: "BRAND_AWARENESS",
      startsAt: null,
      endsAt: null,
    };
    await expect(
      createAdvertiserCampaign(
        bob,
        values,
        "campaign-request-bob-123456",
        dependencies,
      ),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });

    await expect(
      createAdvertiserCampaign(
        alice,
        { ...values, advertiserOrganizationId: aliceOrganization.id },
        "campaign-request-alice-123456",
        dependencies,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        advertiserOrganizationId: aliceOrganization.id,
        status: "DRAFT",
      },
    });
  });

  it("deduplicates retries and rejects idempotency-key payload changes", async () => {
    const dependencies = {
      rbac: rbacRepository(),
      store: tenantStore(),
      now: new Date("2026-07-24T12:00:00.000Z"),
    };
    const values = {
      advertiserOrganizationId: aliceOrganization.id,
      name: "Spring launch",
      objective: "TRAFFIC",
      startsAt: null,
      endsAt: null,
    };
    const key = "campaign-idempotency-key-123";
    const first = await createAdvertiserCampaign(
      alice,
      values,
      key,
      dependencies,
    );
    const replay = await createAdvertiserCampaign(
      alice,
      values,
      key,
      dependencies,
    );
    const conflict = await createAdvertiserCampaign(
      alice,
      { ...values, name: "Different payload" },
      key,
      dependencies,
    );
    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(replay).toMatchObject({ ok: true, replayed: true });
    expect(conflict).toEqual({
      ok: false,
      reason: "idempotency_conflict",
    });
  });
});

describe("advertiser organization creation", () => {
  const values = {
    legalName: "Alice Advertising LLC",
    displayName: "Alice Ads",
    websiteUrl: "https://alice.example/",
    organizationName: "Alice Media Team",
    organizationSlug: "alice-media-team",
    industry: "Media",
    billingEmail: "billing@alice.example",
  };

  it("requires the exact database permission", async () => {
    await expect(
      createAdvertiserOrganization(
        alice,
        values,
        "organization-request-key-123",
        {
          rbac: rbacRepository(),
          store: tenantStore(),
        },
      ),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  it("creates an owner membership with an explicit global grant", async () => {
    const grants = new Map<string, readonly RbacGrant[]>([
      [
        alice.userId,
        [
          {
            roleKey: "advertiser_creator",
            roleName: "Advertiser Creator",
            roleScope: "GLOBAL",
            organizationId: null,
            permissionKey: "advertiser.organization.create",
          },
        ],
      ],
    ]);
    await expect(
      createAdvertiserOrganization(
        alice,
        values,
        "organization-request-key-123",
        {
          rbac: rbacRepository(grants),
          store: tenantStore(),
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { role: "OWNER", displayName: "Alice Ads" },
    });
  });
});
