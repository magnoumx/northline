import { and, eq, isNull } from "drizzle-orm";
import type { getDb } from "../../db";
import {
  advertiserMembers,
  advertiserOrganizations,
  advertisers,
  campaigns,
  commercialAuditLogs,
  organizationMembers,
  organizations,
} from "../../db/schema-v2";
import type { ChatGPTUser } from "../../app/chatgpt-auth";
import { sha256Base64Url } from "../security/crypto";
import {
  authorizeDatabasePermission,
  type RbacPrincipal,
  type RbacRepository,
} from "./rbac";

type NorthlineDb = Awaited<ReturnType<typeof getDb>>;

export type AdvertiserTenantRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "BUYER"
  | "VIEWER";

export type AdvertiserOrganizationView = {
  id: string;
  organizationId: string;
  advertiserId: string;
  displayName: string;
  legalName: string;
  organizationName: string;
  organizationSlug: string;
  role: AdvertiserTenantRole;
};

export type AdvertiserCampaignView = {
  id: string;
  advertiserOrganizationId: string;
  name: string;
  objective: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type CreateAdvertiserOrganizationInput = {
  legalName: string;
  displayName: string;
  websiteUrl: string;
  organizationName: string;
  organizationSlug: string;
  industry: string | null;
  billingEmail: string | null;
};

export type CreateAdvertiserCampaignInput = {
  advertiserOrganizationId: string;
  name: string;
  objective: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

type IdempotentCreateResult<T> =
  | { outcome: "created"; value: T }
  | { outcome: "replayed"; value: T }
  | { outcome: "conflict" };

export interface AdvertiserTenantStore {
  listOrganizations(userId: string): Promise<readonly AdvertiserOrganizationView[]>;
  getOrganization(
    userId: string,
    advertiserOrganizationId: string,
  ): Promise<AdvertiserOrganizationView | null>;
  createOrganization(input: {
    actor: RbacPrincipal;
    values: CreateAdvertiserOrganizationInput;
    idempotencyId: string;
    requestHash: string;
    now: Date;
  }): Promise<IdempotentCreateResult<AdvertiserOrganizationView>>;
  listCampaigns(
    userId: string,
    advertiserOrganizationId: string,
  ): Promise<readonly AdvertiserCampaignView[]>;
  createCampaign(input: {
    actor: RbacPrincipal;
    membership: AdvertiserOrganizationView;
    values: CreateAdvertiserCampaignInput;
    idempotencyId: string;
    requestHash: string;
    now: Date;
  }): Promise<IdempotentCreateResult<AdvertiserCampaignView>>;
}

export type AdvertiserServiceResult<T> =
  | { ok: true; value: T; replayed?: boolean }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "not_found"
        | "idempotency_conflict"
        | "storage_unavailable";
    };

export function createD1AdvertiserTenantStore(
  db: NorthlineDb,
): AdvertiserTenantStore {
  return {
    async listOrganizations(userId) {
      const rows = await organizationMembershipQuery(db, userId);
      return rows.flatMap(toOrganizationView);
    },

    async getOrganization(userId, advertiserOrganizationId) {
      const rows = await organizationMembershipQuery(
        db,
        userId,
        advertiserOrganizationId,
      );
      return rows.flatMap(toOrganizationView)[0] ?? null;
    },

    async createOrganization({
      actor,
      values,
      idempotencyId,
      requestHash,
      now,
    }) {
      const replay = await readIdempotentOrganization(
        db,
        idempotencyId,
        actor.userId,
        requestHash,
      );
      if (replay) return replay;

      const advertiserId = `adv_${crypto.randomUUID()}`;
      const organizationId = `org_${crypto.randomUUID()}`;
      const advertiserOrganizationId = `aorg_${crypto.randomUUID()}`;
      const value: AdvertiserOrganizationView = {
        id: advertiserOrganizationId,
        organizationId,
        advertiserId,
        displayName: values.displayName,
        legalName: values.legalName,
        organizationName: values.organizationName,
        organizationSlug: values.organizationSlug,
        role: "OWNER",
      };
      try {
        await db.batch([
          db.insert(advertisers).values({
            id: advertiserId,
            legalName: values.legalName,
            displayName: values.displayName,
            websiteUrl: values.websiteUrl,
            status: "PROSPECT",
            industry: values.industry,
            billingEmail: values.billingEmail,
            riskLevel: "UNREVIEWED",
            createdAt: now,
            updatedAt: now,
          }),
          db.insert(organizations).values({
            id: organizationId,
            slug: values.organizationSlug,
            name: values.organizationName,
            kind: "ADVERTISER",
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
          }),
          db.insert(advertiserOrganizations).values({
            id: advertiserOrganizationId,
            advertiserId,
            organizationId,
            createdAt: now,
            updatedAt: now,
          }),
          db.insert(organizationMembers).values({
            organizationId,
            userId: actor.userId,
            status: "ACTIVE",
            joinedAt: now,
            createdAt: now,
          }),
          db.insert(advertiserMembers).values({
            advertiserOrganizationId,
            userId: actor.userId,
            role: "OWNER",
            status: "ACTIVE",
            createdAt: now,
          }),
          db.insert(commercialAuditLogs).values({
            id: idempotencyId,
            actorId: actor.userId,
            advertiserOrganizationId,
            action: "ADVERTISER_ORGANIZATION_CREATED",
            targetType: "AdvertiserOrganization",
            targetId: advertiserOrganizationId,
            decision: "CREATED",
            reason: "AUTHORIZED_DATABASE_PERMISSION",
            metadataJson: JSON.stringify({ requestHash, response: value }),
            occurredAt: now,
          }),
        ]);
        return { outcome: "created", value };
      } catch (error) {
        const concurrentReplay = await readIdempotentOrganization(
          db,
          idempotencyId,
          actor.userId,
          requestHash,
        );
        if (concurrentReplay) return concurrentReplay;
        throw error;
      }
    },

    async listCampaigns(userId, advertiserOrganizationId) {
      const rows = await db
        .select({
          id: campaigns.id,
          advertiserOrganizationId: campaigns.advertiserOrganizationId,
          name: campaigns.name,
          objective: campaigns.objective,
          status: campaigns.status,
          startsAt: campaigns.startsAt,
          endsAt: campaigns.endsAt,
          createdAt: campaigns.createdAt,
        })
        .from(campaigns)
        .innerJoin(
          advertiserMembers,
          and(
            eq(
              advertiserMembers.advertiserOrganizationId,
              campaigns.advertiserOrganizationId,
            ),
            eq(advertiserMembers.userId, userId),
            eq(advertiserMembers.status, "ACTIVE"),
          ),
        )
        .where(
          eq(
            campaigns.advertiserOrganizationId,
            advertiserOrganizationId,
          ),
        );
      return rows.map(toCampaignView);
    },

    async createCampaign({
      actor,
      membership,
      values,
      idempotencyId,
      requestHash,
      now,
    }) {
      const replay = await readIdempotentCampaign(
        db,
        idempotencyId,
        actor.userId,
        requestHash,
      );
      if (replay) return replay;

      const campaignId = `camp_${crypto.randomUUID()}`;
      const value: AdvertiserCampaignView = {
        id: campaignId,
        advertiserOrganizationId: values.advertiserOrganizationId,
        name: values.name,
        objective: values.objective,
        status: "DRAFT",
        startsAt: values.startsAt?.toISOString() ?? null,
        endsAt: values.endsAt?.toISOString() ?? null,
        createdAt: now.toISOString(),
      };
      try {
        await db.batch([
          db.insert(campaigns).values({
            id: campaignId,
            advertiserOrganizationId: values.advertiserOrganizationId,
            name: values.name,
            objective: values.objective,
            status: "DRAFT",
            startsAt: values.startsAt,
            endsAt: values.endsAt,
            createdById: actor.userId,
            createdAt: now,
            updatedAt: now,
          }),
          db.insert(commercialAuditLogs).values({
            id: idempotencyId,
            actorId: actor.userId,
            advertiserOrganizationId: membership.id,
            action: "ADVERTISER_CAMPAIGN_CREATED",
            targetType: "Campaign",
            targetId: campaignId,
            decision: "CREATED",
            reason: `ACTIVE_${membership.role}_MEMBERSHIP`,
            metadataJson: JSON.stringify({ requestHash, response: value }),
            occurredAt: now,
          }),
        ]);
        return { outcome: "created", value };
      } catch (error) {
        const concurrentReplay = await readIdempotentCampaign(
          db,
          idempotencyId,
          actor.userId,
          requestHash,
        );
        if (concurrentReplay) return concurrentReplay;
        throw error;
      }
    },
  };
}

export async function listAdvertiserOrganizations(
  identity: ChatGPTUser,
  {
    rbac,
    store,
  }: {
    rbac: RbacRepository;
    store: AdvertiserTenantStore;
  },
): Promise<AdvertiserServiceResult<readonly AdvertiserOrganizationView[]>> {
  const principal = await resolveActivePrincipal(identity, rbac);
  if (!principal.ok) return principal;
  try {
    return {
      ok: true,
      value: await store.listOrganizations(principal.value.userId),
    };
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function readAdvertiserOrganization(
  identity: ChatGPTUser,
  advertiserOrganizationId: string,
  dependencies: {
    rbac: RbacRepository;
    store: AdvertiserTenantStore;
  },
): Promise<AdvertiserServiceResult<AdvertiserOrganizationView>> {
  const principal = await resolveActivePrincipal(identity, dependencies.rbac);
  if (!principal.ok) return principal;
  try {
    const organization = await dependencies.store.getOrganization(
      principal.value.userId,
      advertiserOrganizationId,
    );
    return organization
      ? { ok: true, value: organization }
      : { ok: false, reason: "not_found" };
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function createAdvertiserOrganization(
  identity: ChatGPTUser,
  values: CreateAdvertiserOrganizationInput,
  idempotencyKey: string,
  {
    rbac,
    store,
    now = new Date(),
  }: {
    rbac: RbacRepository;
    store: AdvertiserTenantStore;
    now?: Date;
  },
): Promise<AdvertiserServiceResult<AdvertiserOrganizationView>> {
  const authorization = await authorizeDatabasePermission(
    identity,
    "advertiser.organization.create",
    { repository: rbac },
  );
  if (!authorization.allowed) {
    return {
      ok: false,
      reason:
        authorization.reason === "storage_unavailable"
          ? "storage_unavailable"
          : "forbidden",
    };
  }
  const scope = `advertiser_organization:${authorization.principal.userId}`;
  const [idempotencyId, requestHash] = await Promise.all([
    idempotencyRecordId(scope, idempotencyKey),
    sha256Base64Url(JSON.stringify(values)),
  ]);
  try {
    return fromIdempotentCreate(
      await store.createOrganization({
        actor: authorization.principal,
        values,
        idempotencyId,
        requestHash,
        now,
      }),
    );
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function listAdvertiserCampaigns(
  identity: ChatGPTUser,
  advertiserOrganizationId: string,
  dependencies: {
    rbac: RbacRepository;
    store: AdvertiserTenantStore;
  },
): Promise<AdvertiserServiceResult<readonly AdvertiserCampaignView[]>> {
  const principal = await resolveActivePrincipal(identity, dependencies.rbac);
  if (!principal.ok) return principal;
  try {
    const organization = await dependencies.store.getOrganization(
      principal.value.userId,
      advertiserOrganizationId,
    );
    if (!organization) return { ok: false, reason: "not_found" };
    return {
      ok: true,
      value: await dependencies.store.listCampaigns(
        principal.value.userId,
        advertiserOrganizationId,
      ),
    };
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function createAdvertiserCampaign(
  identity: ChatGPTUser,
  values: CreateAdvertiserCampaignInput,
  idempotencyKey: string,
  {
    rbac,
    store,
    now = new Date(),
  }: {
    rbac: RbacRepository;
    store: AdvertiserTenantStore;
    now?: Date;
  },
): Promise<AdvertiserServiceResult<AdvertiserCampaignView>> {
  const principal = await resolveActivePrincipal(identity, rbac);
  if (!principal.ok) return principal;
  let membership: AdvertiserOrganizationView | null;
  try {
    membership = await store.getOrganization(
      principal.value.userId,
      values.advertiserOrganizationId,
    );
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
  if (!membership) return { ok: false, reason: "not_found" };
  if (!canCreateCampaign(membership.role)) {
    return { ok: false, reason: "forbidden" };
  }
  const scope = `advertiser_campaign:${principal.value.userId}:${membership.id}`;
  const [idempotencyId, requestHash] = await Promise.all([
    idempotencyRecordId(scope, idempotencyKey),
    sha256Base64Url(
      JSON.stringify({
        ...values,
        startsAt: values.startsAt?.toISOString() ?? null,
        endsAt: values.endsAt?.toISOString() ?? null,
      }),
    ),
  ]);
  try {
    return fromIdempotentCreate(
      await store.createCampaign({
        actor: principal.value,
        membership,
        values,
        idempotencyId,
        requestHash,
        now,
      }),
    );
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
}

export function canCreateCampaign(role: AdvertiserTenantRole): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "BUYER"
  );
}

async function resolveActivePrincipal(
  identity: Pick<ChatGPTUser, "userId" | "email" | "provider">,
  repository: RbacRepository,
): Promise<
  | { ok: true; value: RbacPrincipal }
  | { ok: false; reason: "forbidden" | "storage_unavailable" }
> {
  try {
    const principal = await repository.findPrincipal(identity);
    if (!principal || principal.status.trim().toLowerCase() !== "active") {
      return { ok: false, reason: "forbidden" };
    }
    return { ok: true, value: principal };
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
}

async function organizationMembershipQuery(
  db: NorthlineDb,
  userId: string,
  advertiserOrganizationId?: string,
) {
  const conditions = [
    eq(advertiserMembers.userId, userId),
    eq(advertiserMembers.status, "ACTIVE"),
    eq(organizations.status, "ACTIVE"),
    isNull(advertisers.disabledAt),
  ];
  if (advertiserOrganizationId) {
    conditions.push(
      eq(advertiserOrganizations.id, advertiserOrganizationId),
    );
  }
  return db
    .select({
      id: advertiserOrganizations.id,
      organizationId: advertiserOrganizations.organizationId,
      advertiserId: advertiserOrganizations.advertiserId,
      displayName: advertisers.displayName,
      legalName: advertisers.legalName,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: advertiserMembers.role,
    })
    .from(advertiserMembers)
    .innerJoin(
      advertiserOrganizations,
      eq(
        advertiserMembers.advertiserOrganizationId,
        advertiserOrganizations.id,
      ),
    )
    .innerJoin(
      advertisers,
      eq(advertiserOrganizations.advertiserId, advertisers.id),
    )
    .innerJoin(
      organizations,
      eq(advertiserOrganizations.organizationId, organizations.id),
    )
    .where(and(...conditions));
}

function toOrganizationView(
  row: Omit<AdvertiserOrganizationView, "role"> & { role: string },
): AdvertiserOrganizationView[] {
  const role = normalizeTenantRole(row.role);
  return role ? [{ ...row, role }] : [];
}

function normalizeTenantRole(value: string): AdvertiserTenantRole | null {
  const normalized = value.trim().toUpperCase();
  return normalized === "OWNER" ||
    normalized === "ADMIN" ||
    normalized === "MANAGER" ||
    normalized === "BUYER" ||
    normalized === "VIEWER"
    ? normalized
    : null;
}

function toCampaignView(row: {
  id: string;
  advertiserOrganizationId: string;
  name: string;
  objective: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
}): AdvertiserCampaignView {
  return {
    ...row,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function idempotencyRecordId(
  scope: string,
  idempotencyKey: string,
): Promise<string> {
  return `idem_${(
    await sha256Base64Url(`${scope}\0${idempotencyKey}`)
  ).slice(0, 48)}`;
}

function fromIdempotentCreate<T>(
  result: IdempotentCreateResult<T>,
): AdvertiserServiceResult<T> {
  if (result.outcome === "conflict") {
    return { ok: false, reason: "idempotency_conflict" };
  }
  return {
    ok: true,
    value: result.value,
    replayed: result.outcome === "replayed",
  };
}

async function readIdempotentOrganization(
  db: NorthlineDb,
  id: string,
  actorId: string,
  requestHash: string,
): Promise<IdempotentCreateResult<AdvertiserOrganizationView> | null> {
  return readIdempotentResult(
    db,
    id,
    actorId,
    requestHash,
    isOrganizationView,
  );
}

async function readIdempotentCampaign(
  db: NorthlineDb,
  id: string,
  actorId: string,
  requestHash: string,
): Promise<IdempotentCreateResult<AdvertiserCampaignView> | null> {
  return readIdempotentResult(
    db,
    id,
    actorId,
    requestHash,
    isCampaignView,
  );
}

async function readIdempotentResult<T>(
  db: NorthlineDb,
  id: string,
  actorId: string,
  requestHash: string,
  validate: (value: unknown) => value is T,
): Promise<IdempotentCreateResult<T> | null> {
  const [record] = await db
    .select({
      actorId: commercialAuditLogs.actorId,
      metadataJson: commercialAuditLogs.metadataJson,
    })
    .from(commercialAuditLogs)
    .where(eq(commercialAuditLogs.id, id))
    .limit(1);
  if (!record) return null;
  if (record.actorId !== actorId) return { outcome: "conflict" };
  let metadata: unknown;
  try {
    metadata = JSON.parse(record.metadataJson) as unknown;
  } catch {
    return { outcome: "conflict" };
  }
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    !("requestHash" in metadata) ||
    metadata.requestHash !== requestHash ||
    !("response" in metadata) ||
    !validate(metadata.response)
  ) {
    return { outcome: "conflict" };
  }
  return { outcome: "replayed", value: metadata.response };
}

function isOrganizationView(
  value: unknown,
): value is AdvertiserOrganizationView {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<AdvertiserOrganizationView>;
  return (
    typeof record.id === "string" &&
    typeof record.organizationId === "string" &&
    typeof record.advertiserId === "string" &&
    typeof record.displayName === "string" &&
    typeof record.legalName === "string" &&
    typeof record.organizationName === "string" &&
    typeof record.organizationSlug === "string" &&
    typeof record.role === "string" &&
    normalizeTenantRole(record.role) !== null
  );
}

function isCampaignView(value: unknown): value is AdvertiserCampaignView {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<AdvertiserCampaignView>;
  return (
    typeof record.id === "string" &&
    typeof record.advertiserOrganizationId === "string" &&
    typeof record.name === "string" &&
    typeof record.objective === "string" &&
    typeof record.status === "string" &&
    (record.startsAt === null || typeof record.startsAt === "string") &&
    (record.endsAt === null || typeof record.endsAt === "string") &&
    typeof record.createdAt === "string"
  );
}
