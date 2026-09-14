import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { articles, users } from "./schema";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

const occurredAt = integer("occurred_at", { mode: "timestamp_ms" })
  .notNull()
  .default(sql`(unixepoch() * 1000)`);

export const authAccounts = sqliteTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    passwordHash: text("password_hash"),
    emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
    disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_account_uq").on(
      table.provider,
      table.providerAccountId,
    ),
    index("auth_accounts_user_idx").on(table.userId),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    rotationFamilyHash: text("rotation_family_hash").notNull(),
    userAgentHash: text("user_agent_hash"),
    clientIpHash: text("client_ip_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    revocationReason: text("revocation_reason"),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_uq").on(table.tokenHash),
    index("auth_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
    index("auth_sessions_family_idx").on(table.rotationFamilyHash),
  ],
);

export const authSecurityProfiles = sqliteTable(
  "auth_security_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    mfaMethod: text("mfa_method"),
    mfaSecretEncrypted: text("mfa_secret_encrypted"),
    mfaEnabledAt: integer("mfa_enabled_at", { mode: "timestamp_ms" }),
    lastPasswordChangeAt: integer("last_password_change_at", {
      mode: "timestamp_ms",
    }),
    ...timestamps,
  },
  (table) => [
    check("auth_security_profiles_failed_count_ck", sql`${table.failedLoginCount} >= 0`),
  ],
);

export const authRecoveryCodes = sqliteTable(
  "auth_recovery_codes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("auth_recovery_codes_hash_uq").on(table.codeHash),
    index("auth_recovery_codes_user_idx").on(table.userId),
  ],
);

export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    scope: text("scope").notNull().default("STAFF"),
    description: text("description"),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("roles_key_uq").on(table.key),
    check("roles_scope_ck", sql`${table.scope} IN ('STAFF', 'ADVERTISER', 'GLOBAL')`),
  ],
);

export const permissions = sqliteTable(
  "permissions",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    description: text("description").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("permissions_key_uq").on(table.key)],
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
    index("role_permissions_permission_idx").on(table.permissionId),
  ],
);

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("ADVERTISER"),
    status: text("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organizations_slug_uq").on(table.slug),
    index("organizations_kind_status_idx").on(table.kind, table.status),
  ],
);

export const organizationMembers = sqliteTable(
  "organization_members",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("ACTIVE"),
    invitedById: text("invited_by_id").references(() => users.id),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("organization_members_user_idx").on(table.userId, table.status),
  ],
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    grantedById: text("granted_by_id").references(() => users.id),
    grantedAt: integer("granted_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("user_roles_scope_uq").on(
      table.userId,
      table.roleId,
      table.organizationId,
    ),
    index("user_roles_org_idx").on(table.organizationId, table.roleId),
  ],
);

export const readerProfiles = sqliteTable(
  "reader_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    timeZone: text("time_zone").notNull().default("America/New_York"),
    theme: text("theme").notNull().default("SYSTEM"),
    textScale: integer("text_scale").notNull().default(100),
    personalizationEnabled: integer("personalization_enabled", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (table) => [
    check("reader_profiles_text_scale_ck", sql`${table.textScale} BETWEEN 80 AND 140`),
  ],
);

export const readingHistory = sqliteTable(
  "reading_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    firstViewedAt: integer("first_viewed_at", { mode: "timestamp_ms" }).notNull(),
    lastViewedAt: integer("last_viewed_at", { mode: "timestamp_ms" }).notNull(),
    completionPercent: integer("completion_percent").notNull().default(0),
    viewCount: integer("view_count").notNull().default(1),
  },
  (table) => [
    uniqueIndex("reading_history_user_article_uq").on(table.userId, table.articleId),
    index("reading_history_recent_idx").on(table.userId, table.lastViewedAt),
    check(
      "reading_history_completion_ck",
      sql`${table.completionPercent} BETWEEN 0 AND 100`,
    ),
  ],
);

export const readerPreferences = sqliteTable(
  "reader_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    preferenceType: text("preference_type").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    valueJson: text("value_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("reader_preferences_target_uq").on(
      table.userId,
      table.preferenceType,
      table.targetType,
      table.targetId,
    ),
    index("reader_preferences_user_type_idx").on(
      table.userId,
      table.preferenceType,
    ),
  ],
);

export const notificationPreferences = sqliteTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    notificationType: text("notification_type").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    quietHoursJson: text("quiet_hours_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_preferences_uq").on(
      table.userId,
      table.channel,
      table.notificationType,
    ),
  ],
);

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    stream: text("stream").notNull(),
    anonymousIdHash: text("anonymous_id_hash"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    articleId: text("article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    metadataJson: text("metadata_json").notNull().default("{}"),
    occurredAt,
  },
  (table) => [
    index("analytics_events_stream_time_idx").on(table.stream, table.occurredAt),
    index("analytics_events_article_time_idx").on(table.articleId, table.occurredAt),
    check(
      "analytics_events_stream_ck",
      sql`${table.stream} IN ('READER', 'EDITORIAL', 'ADVERTISING', 'SECURITY', 'OPERATIONAL')`,
    ),
  ],
);

export const advertisers = sqliteTable(
  "advertisers",
  {
    id: text("id").primaryKey(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    websiteUrl: text("website_url").notNull(),
    status: text("status").notNull().default("PROSPECT"),
    industry: text("industry"),
    billingEmail: text("billing_email"),
    riskLevel: text("risk_level").notNull().default("UNREVIEWED"),
    disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("advertisers_status_idx").on(table.status),
    index("advertisers_website_idx").on(table.websiteUrl),
  ],
);

export const advertiserOrganizations = sqliteTable(
  "advertiser_organizations",
  {
    id: text("id").primaryKey(),
    advertiserId: text("advertiser_id")
      .notNull()
      .references(() => advertisers.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    externalReference: text("external_reference"),
    billingContactJson: text("billing_contact_json").notNull().default("{}"),
    taxMetadataJson: text("tax_metadata_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("advertiser_organizations_org_uq").on(table.organizationId),
    index("advertiser_organizations_advertiser_idx").on(table.advertiserId),
  ],
);

export const advertiserMembers = sqliteTable(
  "advertiser_members",
  {
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("VIEWER"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.advertiserOrganizationId, table.userId] }),
    index("advertiser_members_user_idx").on(table.userId, table.status),
  ],
);

export const advertisingLeads = sqliteTable(
  "advertising_leads",
  {
    id: text("id").primaryKey(),
    emailHash: text("email_hash").notNull(),
    fullName: text("full_name").notNull(),
    workEmail: text("work_email").notNull(),
    company: text("company").notNull(),
    companyWebsite: text("company_website").notNull(),
    campaignObjective: text("campaign_objective").notNull(),
    productOrService: text("product_or_service").notNull(),
    targetAudience: text("target_audience").notNull(),
    targetCountriesJson: text("target_countries_json").notNull().default("[]"),
    preferredCategoriesJson: text("preferred_categories_json").notNull().default("[]"),
    preferredPlacementsJson: text("preferred_placements_json").notNull().default("[]"),
    estimatedBudgetCents: integer("estimated_budget_cents"),
    desiredStartAt: integer("desired_start_at", { mode: "timestamp_ms" }),
    desiredEndAt: integer("desired_end_at", { mode: "timestamp_ms" }),
    creativeStatus: text("creative_status").notNull(),
    sponsoredContentInterest: integer("sponsored_content_interest", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    newsletterSponsorshipInterest: integer("newsletter_sponsorship_interest", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    message: text("message"),
    consentedAt: integer("consented_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("NEW"),
    duplicateOfId: text("duplicate_of_id"),
    assignedToId: text("assigned_to_id").references(() => users.id),
    nextFollowUpAt: integer("next_follow_up_at", { mode: "timestamp_ms" }),
    spamScore: integer("spam_score").notNull().default(0),
    sourceIpHash: text("source_ip_hash"),
    ...timestamps,
  },
  (table) => [
    index("advertising_leads_status_followup_idx").on(
      table.status,
      table.nextFollowUpAt,
    ),
    index("advertising_leads_email_created_idx").on(table.emailHash, table.createdAt),
    check(
      "advertising_leads_status_ck",
      sql`${table.status} IN ('NEW','QUALIFYING','CONTACTED','PROPOSAL_SENT','NEGOTIATING','WON','LOST','SPAM','ARCHIVED')`,
    ),
    check(
      "advertising_leads_dates_ck",
      sql`${table.desiredEndAt} IS NULL OR ${table.desiredStartAt} IS NULL OR ${table.desiredEndAt} >= ${table.desiredStartAt}`,
    ),
  ],
);

export const salesContacts = sqliteTable(
  "sales_contacts",
  {
    id: text("id").primaryKey(),
    advertiserId: text("advertiser_id")
      .notNull()
      .references(() => advertisers.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    title: text("title"),
    phone: text("phone"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sales_contacts_advertiser_email_uq").on(
      table.advertiserId,
      table.email,
    ),
  ],
);

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    objective: text("objective").notNull(),
    status: text("status").notNull().default("DRAFT"),
    currency: text("currency").notNull().default("USD"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
    termsAcceptedById: text("terms_accepted_by_id").references(() => users.id),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    approvedById: text("approved_by_id").references(() => users.id),
    killedAt: integer("killed_at", { mode: "timestamp_ms" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("campaigns_org_status_idx").on(
      table.advertiserOrganizationId,
      table.status,
    ),
    index("campaigns_schedule_idx").on(table.startsAt, table.endsAt),
    check(
      "campaigns_dates_ck",
      sql`${table.endsAt} IS NULL OR ${table.startsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);

export const campaignOrders = sqliteTable(
  "campaign_orders",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    orderNumber: text("order_number").notNull(),
    status: text("status").notNull().default("DRAFT"),
    totalCents: integer("total_cents").notNull().default(0),
    signedAt: integer("signed_at", { mode: "timestamp_ms" }),
    signedById: text("signed_by_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaign_orders_number_uq").on(table.orderNumber),
    index("campaign_orders_campaign_idx").on(table.campaignId, table.status),
    check("campaign_orders_total_ck", sql`${table.totalCents} >= 0`),
  ],
);

export const adPlacements = sqliteTable(
  "ad_placements",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    supportedDimensionsJson: text("supported_dimensions_json").notNull(),
    mobileBehavior: text("mobile_behavior").notNull(),
    allowedCreativeTypesJson: text("allowed_creative_types_json").notNull(),
    maximumFileBytes: integer("maximum_file_bytes").notNull(),
    performanceBudgetJson: text("performance_budget_json").notNull().default("{}"),
    sensitiveContentPolicy: text("sensitive_content_policy").notNull(),
    maximumDensity: integer("maximum_density").notNull().default(1),
    viewabilityExpectation: integer("viewability_expectation").notNull().default(50),
    fallbackBehavior: text("fallback_behavior").notNull().default("COLLAPSE"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    killedAt: integer("killed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ad_placements_code_uq").on(table.code),
    check("ad_placements_file_size_ck", sql`${table.maximumFileBytes} > 0`),
    check(
      "ad_placements_viewability_ck",
      sql`${table.viewabilityExpectation} BETWEEN 0 AND 100`,
    ),
  ],
);

export const adSlots = sqliteTable(
  "ad_slots",
  {
    id: text("id").primaryKey(),
    placementId: text("placement_id")
      .notNull()
      .references(() => adPlacements.id, { onDelete: "restrict" }),
    pagePattern: text("page_pattern").notNull(),
    ordinal: integer("ordinal").notNull().default(1),
    minimumPublisherContentChars: integer("minimum_publisher_content_chars")
      .notNull()
      .default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ad_slots_placement_page_ordinal_uq").on(
      table.placementId,
      table.pagePattern,
      table.ordinal,
    ),
  ],
);

export const inventoryForecasts = sqliteTable(
  "inventory_forecasts",
  {
    id: text("id").primaryKey(),
    placementId: text("placement_id")
      .notNull()
      .references(() => adPlacements.id, { onDelete: "cascade" }),
    windowStartsAt: integer("window_starts_at", { mode: "timestamp_ms" }).notNull(),
    windowEndsAt: integer("window_ends_at", { mode: "timestamp_ms" }).notNull(),
    estimatedLow: integer("estimated_low").notNull(),
    estimatedHigh: integer("estimated_high").notNull(),
    reservedImpressions: integer("reserved_impressions").notNull().default(0),
    confidence: text("confidence").notNull(),
    assumptionsJson: text("assumptions_json").notNull().default("[]"),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("inventory_forecasts_placement_window_idx").on(
      table.placementId,
      table.windowStartsAt,
      table.windowEndsAt,
    ),
    check(
      "inventory_forecasts_range_ck",
      sql`${table.estimatedLow} >= 0 AND ${table.estimatedHigh} >= ${table.estimatedLow} AND ${table.reservedImpressions} >= 0`,
    ),
  ],
);

export const pricingRules = sqliteTable(
  "pricing_rules",
  {
    id: text("id").primaryKey(),
    placementId: text("placement_id").references(() => adPlacements.id, {
      onDelete: "cascade",
    }),
    pricingModel: text("pricing_model").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    minimumSpendCents: integer("minimum_spend_cents").notNull().default(0),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("pricing_rules_placement_model_idx").on(
      table.placementId,
      table.pricingModel,
    ),
    check(
      "pricing_rules_model_ck",
      sql`${table.pricingModel} IN ('FLAT_FEE','CPD','CPM','VIEWABLE_CPM','CPC','SPONSORSHIP_SHARE','NEWSLETTER_FLAT_FEE','SPONSORED_CONTENT_FEE')`,
    ),
    check(
      "pricing_rules_amount_ck",
      sql`${table.unitPriceCents} >= 0 AND ${table.minimumSpendCents} >= 0`,
    ),
  ],
);

export const targetingRules = sqliteTable(
  "targeting_rules",
  {
    id: text("id").primaryKey(),
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    countriesJson: text("countries_json").notNull().default("[]"),
    devicesJson: text("devices_json").notNull().default("[]"),
    categoriesJson: text("categories_json").notNull().default("[]"),
    excludedPagesJson: text("excluded_pages_json").notNull().default("[]"),
    excludedSensitiveContent: integer("excluded_sensitive_content", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    sensitiveTraitsJson: text("sensitive_traits_json").notNull().default("[]"),
    ...timestamps,
  },
  (table) => [
    index("targeting_rules_org_idx").on(table.advertiserOrganizationId),
  ],
);

export const frequencyCaps = sqliteTable(
  "frequency_caps",
  {
    id: text("id").primaryKey(),
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().default("LINE_ITEM"),
    maximumViews: integer("maximum_views").notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "frequency_caps_positive_ck",
      sql`${table.maximumViews} > 0 AND ${table.windowSeconds} > 0`,
    ),
  ],
);

export const campaignBudgets = sqliteTable(
  "campaign_budgets",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    totalCents: integer("total_cents").notNull(),
    dailyCents: integer("daily_cents"),
    committedCents: integer("committed_cents").notNull().default(0),
    spentCents: integer("spent_cents").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaign_budgets_campaign_uq").on(table.campaignId),
    check(
      "campaign_budgets_amounts_ck",
      sql`${table.totalCents} >= 0 AND (${table.dailyCents} IS NULL OR ${table.dailyCents} >= 0) AND ${table.committedCents} >= 0 AND ${table.spentCents} >= 0`,
    ),
  ],
);

export const lineItems = sqliteTable(
  "line_items",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    campaignOrderId: text("campaign_order_id").references(() => campaignOrders.id, {
      onDelete: "restrict",
    }),
    placementId: text("placement_id")
      .notNull()
      .references(() => adPlacements.id, { onDelete: "restrict" }),
    targetingRuleId: text("targeting_rule_id").references(() => targetingRules.id, {
      onDelete: "restrict",
    }),
    frequencyCapId: text("frequency_cap_id").references(() => frequencyCaps.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    timeZone: text("time_zone").notNull().default("America/New_York"),
    pricingModel: text("pricing_model").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    contractedImpressions: integer("contracted_impressions"),
    contractedClicks: integer("contracted_clicks"),
    dailyBudgetCents: integer("daily_budget_cents"),
    totalBudgetCents: integer("total_budget_cents").notNull(),
    pacing: text("pacing").notNull().default("EVEN"),
    priority: integer("priority").notNull().default(5),
    status: text("status").notNull().default("DRAFT"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    approvedById: text("approved_by_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("line_items_campaign_status_idx").on(table.campaignId, table.status),
    index("line_items_delivery_window_idx").on(
      table.placementId,
      table.status,
      table.startsAt,
      table.endsAt,
    ),
    check(
      "line_items_status_ck",
      sql`${table.status} IN ('DRAFT','PENDING_REVIEW','CHANGES_REQUIRED','APPROVED','READY','DELIVERING','PAUSED','COMPLETED','UNDERDELIVERED','CANCELLED','REJECTED')`,
    ),
    check(
      "line_items_model_ck",
      sql`${table.pricingModel} IN ('FLAT_FEE','CPD','CPM','VIEWABLE_CPM','CPC','SPONSORSHIP_SHARE','NEWSLETTER_FLAT_FEE','SPONSORED_CONTENT_FEE')`,
    ),
    check(
      "line_items_values_ck",
      sql`${table.endsAt} >= ${table.startsAt} AND ${table.unitPriceCents} >= 0 AND ${table.totalBudgetCents} >= 0 AND ${table.priority} BETWEEN 1 AND 10`,
    ),
  ],
);

export const creatives = sqliteTable(
  "creatives",
  {
    id: text("id").primaryKey(),
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    creativeType: text("creative_type").notNull(),
    status: text("status").notNull().default("DRAFT"),
    destinationUrlNormalized: text("destination_url_normalized").notNull(),
    destinationHost: text("destination_host").notNull(),
    killedAt: integer("killed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("creatives_org_status_idx").on(
      table.advertiserOrganizationId,
      table.status,
    ),
    check(
      "creatives_type_ck",
      sql`${table.creativeType} IN ('IMAGE','HTML_SANITIZED','NATIVE_CARD','VIDEO_VAST_FROM_APPROVED_PROVIDER')`,
    ),
  ],
);

export const lineItemCreatives = sqliteTable(
  "line_item_creatives",
  {
    lineItemId: text("line_item_id")
      .notNull()
      .references(() => lineItems.id, { onDelete: "cascade" }),
    creativeId: text("creative_id")
      .notNull()
      .references(() => creatives.id, { onDelete: "restrict" }),
    weight: integer("weight").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.lineItemId, table.creativeId] }),
    check("line_item_creatives_weight_ck", sql`${table.weight} > 0`),
  ],
);

export const creativeVersions = sqliteTable(
  "creative_versions",
  {
    id: text("id").primaryKey(),
    creativeId: text("creative_id")
      .notNull()
      .references(() => creatives.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    contentHash: text("content_hash").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    storageKey: text("storage_key"),
    sanitizedMarkup: text("sanitized_markup"),
    nativePayloadJson: text("native_payload_json"),
    scanStatus: text("scan_status").notNull().default("QUARANTINED"),
    metadataStripped: integer("metadata_stripped", { mode: "boolean" })
      .notNull()
      .default(false),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("creative_versions_version_uq").on(
      table.creativeId,
      table.version,
    ),
    uniqueIndex("creative_versions_hash_uq").on(table.contentHash),
    check("creative_versions_size_ck", sql`${table.byteSize} > 0`),
  ],
);

export const creativeApprovals = sqliteTable(
  "creative_approvals",
  {
    id: text("id").primaryKey(),
    creativeVersionId: text("creative_version_id")
      .notNull()
      .references(() => creativeVersions.id, { onDelete: "restrict" }),
    decision: text("decision").notNull(),
    policyCategoriesJson: text("policy_categories_json").notNull().default("[]"),
    destinationCheckedAt: integer("destination_checked_at", {
      mode: "timestamp_ms",
    }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    occurredAt,
  },
  (table) => [
    index("creative_approvals_version_time_idx").on(
      table.creativeVersionId,
      table.occurredAt,
    ),
    check(
      "creative_approvals_decision_ck",
      sql`${table.decision} IN ('APPROVED','REJECTED','CHANGES_REQUIRED','REVOKED')`,
    ),
  ],
);

export const campaignDeliveries = sqliteTable(
  "campaign_deliveries",
  {
    id: text("id").primaryKey(),
    lineItemId: text("line_item_id")
      .notNull()
      .references(() => lineItems.id, { onDelete: "restrict" }),
    bucketDate: text("bucket_date").notNull(),
    placementId: text("placement_id")
      .notNull()
      .references(() => adPlacements.id),
    country: text("country").notNull().default("UNKNOWN"),
    device: text("device").notNull().default("UNKNOWN"),
    creativeId: text("creative_id").references(() => creatives.id),
    requested: integer("requested").notNull().default(0),
    served: integer("served").notNull().default(0),
    viewable: integer("viewable").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    invalidEvents: integer("invalid_events").notNull().default(0),
    billableUnits: integer("billable_units").notNull().default(0),
    spendCents: integer("spend_cents").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaign_deliveries_bucket_uq").on(
      table.lineItemId,
      table.bucketDate,
      table.placementId,
      table.country,
      table.device,
      table.creativeId,
    ),
    check(
      "campaign_deliveries_counts_ck",
      sql`${table.requested} >= 0 AND ${table.served} >= 0 AND ${table.viewable} >= 0 AND ${table.clicks} >= 0 AND ${table.invalidEvents} >= 0 AND ${table.billableUnits} >= 0 AND ${table.spendCents} >= 0`,
    ),
  ],
);

export const adRequests = sqliteTable(
  "ad_requests",
  {
    id: text("id").primaryKey(),
    placementId: text("placement_id")
      .notNull()
      .references(() => adPlacements.id),
    lineItemId: text("line_item_id").references(() => lineItems.id),
    creativeVersionId: text("creative_version_id").references(
      () => creativeVersions.id,
    ),
    anonymousViewerHash: text("anonymous_viewer_hash"),
    clientIpHash: text("client_ip_hash"),
    pageClass: text("page_class").notNull(),
    country: text("country").notNull().default("UNKNOWN"),
    device: text("device").notNull().default("UNKNOWN"),
    selectionReason: text("selection_reason").notNull(),
    isInternal: integer("is_internal", { mode: "boolean" }).notNull().default(false),
    isCrawler: integer("is_crawler", { mode: "boolean" }).notNull().default(false),
    occurredAt,
  },
  (table) => [
    index("ad_requests_placement_time_idx").on(table.placementId, table.occurredAt),
    index("ad_requests_line_item_time_idx").on(table.lineItemId, table.occurredAt),
  ],
);

export const adImpressions = sqliteTable(
  "ad_impressions",
  {
    id: text("id").primaryKey(),
    adRequestId: text("ad_request_id")
      .notNull()
      .references(() => adRequests.id, { onDelete: "restrict" }),
    tokenNonceHash: text("token_nonce_hash").notNull(),
    lineItemId: text("line_item_id")
      .notNull()
      .references(() => lineItems.id),
    creativeVersionId: text("creative_version_id")
      .notNull()
      .references(() => creativeVersions.id),
    validationState: text("validation_state").notNull().default("RAW"),
    billable: integer("billable", { mode: "boolean" }).notNull().default(false),
    occurredAt,
  },
  (table) => [
    uniqueIndex("ad_impressions_request_uq").on(table.adRequestId),
    uniqueIndex("ad_impressions_nonce_uq").on(table.tokenNonceHash),
    index("ad_impressions_line_item_time_idx").on(
      table.lineItemId,
      table.occurredAt,
    ),
  ],
);

export const viewableImpressions = sqliteTable(
  "viewable_impressions",
  {
    id: text("id").primaryKey(),
    impressionId: text("impression_id")
      .notNull()
      .references(() => adImpressions.id, { onDelete: "restrict" }),
    tokenNonceHash: text("token_nonce_hash").notNull(),
    visiblePercent: integer("visible_percent").notNull(),
    visibleMilliseconds: integer("visible_milliseconds").notNull(),
    validated: integer("validated", { mode: "boolean" }).notNull().default(false),
    occurredAt,
  },
  (table) => [
    uniqueIndex("viewable_impressions_impression_uq").on(table.impressionId),
    uniqueIndex("viewable_impressions_nonce_uq").on(table.tokenNonceHash),
    check(
      "viewable_impressions_values_ck",
      sql`${table.visiblePercent} BETWEEN 0 AND 100 AND ${table.visibleMilliseconds} >= 0`,
    ),
  ],
);

export const adClicks = sqliteTable(
  "ad_clicks",
  {
    id: text("id").primaryKey(),
    impressionId: text("impression_id")
      .notNull()
      .references(() => adImpressions.id, { onDelete: "restrict" }),
    tokenNonceHash: text("token_nonce_hash").notNull(),
    destinationUrlNormalized: text("destination_url_normalized").notNull(),
    validationState: text("validation_state").notNull().default("RAW"),
    billable: integer("billable", { mode: "boolean" }).notNull().default(false),
    occurredAt,
  },
  (table) => [
    uniqueIndex("ad_clicks_nonce_uq").on(table.tokenNonceHash),
    index("ad_clicks_impression_time_idx").on(table.impressionId, table.occurredAt),
  ],
);

export const invalidTrafficEvents = sqliteTable(
  "invalid_traffic_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    eventId: text("event_id").notNull(),
    reasonCode: text("reason_code").notNull(),
    riskScore: integer("risk_score").notNull(),
    detector: text("detector").notNull(),
    evidenceJson: text("evidence_json").notNull().default("{}"),
    reviewedById: text("reviewed_by_id").references(() => users.id),
    occurredAt,
  },
  (table) => [
    uniqueIndex("invalid_traffic_event_uq").on(
      table.eventType,
      table.eventId,
      table.reasonCode,
    ),
    check(
      "invalid_traffic_risk_ck",
      sql`${table.riskScore} BETWEEN 0 AND 100`,
    ),
  ],
);

export const conversionEvents = sqliteTable(
  "conversion_events",
  {
    id: text("id").primaryKey(),
    clickId: text("click_id").references(() => adClicks.id, {
      onDelete: "restrict",
    }),
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id),
    externalEventHash: text("external_event_hash").notNull(),
    conversionType: text("conversion_type").notNull(),
    valueCents: integer("value_cents"),
    currency: text("currency"),
    validated: integer("validated", { mode: "boolean" }).notNull().default(false),
    occurredAt,
  },
  (table) => [
    uniqueIndex("conversion_events_external_uq").on(
      table.advertiserOrganizationId,
      table.externalEventHash,
    ),
  ],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id, { onDelete: "restrict" }),
    campaignId: text("campaign_id").references(() => campaigns.id, {
      onDelete: "restrict",
    }),
    invoiceNumber: text("invoice_number").notNull(),
    status: text("status").notNull().default("DRAFT"),
    currency: text("currency").notNull().default("USD"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    immutableAt: integer("immutable_at", { mode: "timestamp_ms" }),
    provider: text("provider").notNull().default("MANUAL"),
    providerReference: text("provider_reference"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invoices_number_uq").on(table.invoiceNumber),
    index("invoices_org_status_idx").on(
      table.advertiserOrganizationId,
      table.status,
    ),
    check(
      "invoices_status_ck",
      sql`${table.status} IN ('DRAFT','SENT','PAID','PARTIALLY_PAID','PAYMENT_FAILED','REFUNDED','CREDITED','OVERDUE','CANCELLED')`,
    ),
    check(
      "invoices_amounts_ck",
      sql`${table.subtotalCents} >= 0 AND ${table.taxCents} >= 0 AND ${table.totalCents} >= 0 AND ${table.amountPaidCents} >= 0`,
    ),
  ],
);

export const invoiceLines = sqliteTable(
  "invoice_lines",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    lineItemId: text("line_item_id").references(() => lineItems.id, {
      onDelete: "restrict",
    }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    evidenceJson: text("evidence_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("invoice_lines_invoice_idx").on(table.invoiceId),
    check(
      "invoice_lines_amounts_ck",
      sql`${table.quantity} >= 0 AND ${table.unitPriceCents} >= 0 AND ${table.amountCents} >= 0`,
    ),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference").notNull(),
    status: text("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payments_provider_reference_uq").on(
      table.provider,
      table.providerReference,
    ),
    check("payments_amount_ck", sql`${table.amountCents} > 0`),
  ],
);

export const refunds = sqliteTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("PENDING"),
    providerReference: text("provider_reference"),
    approvedById: text("approved_by_id")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("refunds_payment_idx").on(table.paymentId),
    check("refunds_amount_ck", sql`${table.amountCents} > 0`),
  ],
);

export const credits = sqliteTable(
  "credits",
  {
    id: text("id").primaryKey(),
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id, { onDelete: "restrict" }),
    invoiceId: text("invoice_id").references(() => invoices.id, {
      onDelete: "restrict",
    }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    remainingCents: integer("remaining_cents").notNull(),
    approvedById: text("approved_by_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    check(
      "credits_amount_ck",
      sql`${table.amountCents} > 0 AND ${table.remainingCents} >= 0 AND ${table.remainingCents} <= ${table.amountCents}`,
    ),
  ],
);

export const makeGoods = sqliteTable(
  "make_goods",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    lineItemId: text("line_item_id").references(() => lineItems.id, {
      onDelete: "restrict",
    }),
    reason: text("reason").notNull(),
    owedUnits: integer("owed_units").notNull(),
    deliveredUnits: integer("delivered_units").notNull().default(0),
    status: text("status").notNull().default("OPEN"),
    approvedById: text("approved_by_id")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    check(
      "make_goods_units_ck",
      sql`${table.owedUnits} > 0 AND ${table.deliveredUnits} >= 0`,
    ),
  ],
);

export const campaignReports = sqliteTable(
  "campaign_reports",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    reportType: text("report_type").notNull(),
    windowStartsAt: integer("window_starts_at", { mode: "timestamp_ms" }).notNull(),
    windowEndsAt: integer("window_ends_at", { mode: "timestamp_ms" }).notNull(),
    rawEvents: integer("raw_events").notNull().default(0),
    validatedEvents: integer("validated_events").notNull().default(0),
    billableEvents: integer("billable_events").notNull().default(0),
    estimatesJson: text("estimates_json").notNull().default("{}"),
    breakdownJson: text("breakdown_json").notNull().default("{}"),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }).notNull(),
    generatedById: text("generated_by_id").references(() => users.id),
  },
  (table) => [
    index("campaign_reports_campaign_window_idx").on(
      table.campaignId,
      table.windowStartsAt,
    ),
    check(
      "campaign_reports_counts_ck",
      sql`${table.rawEvents} >= 0 AND ${table.validatedEvents} >= 0 AND ${table.billableEvents} >= 0`,
    ),
  ],
);

export const sponsors = sqliteTable(
  "sponsors",
  {
    id: text("id").primaryKey(),
    advertiserOrganizationId: text("advertiser_organization_id")
      .notNull()
      .references(() => advertiserOrganizations.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    disclosureText: text("disclosure_text").notNull(),
    logoStorageKey: text("logo_storage_key"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    approvedById: text("approved_by_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("sponsors_advertiser_org_idx").on(table.advertiserOrganizationId),
  ],
);

export const sponsorships = sqliteTable(
  "sponsorships",
  {
    id: text("id").primaryKey(),
    sponsorId: text("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "restrict" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    sponsorshipType: text("sponsorship_type").notNull(),
    targetReference: text("target_reference").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("DRAFT"),
    ...timestamps,
  },
  (table) => [
    index("sponsorships_target_window_idx").on(
      table.sponsorshipType,
      table.targetReference,
      table.startsAt,
      table.endsAt,
    ),
    check("sponsorships_dates_ck", sql`${table.endsAt} >= ${table.startsAt}`),
  ],
);

export const newsletterSponsorships = sqliteTable(
  "newsletter_sponsorships",
  {
    id: text("id").primaryKey(),
    sponsorshipId: text("sponsorship_id")
      .notNull()
      .references(() => sponsorships.id, { onDelete: "restrict" }),
    listKey: text("list_key").notNull(),
    issueDate: text("issue_date").notNull(),
    placement: text("placement").notNull(),
    previewApprovedAt: integer("preview_approved_at", { mode: "timestamp_ms" }),
    status: text("status").notNull().default("HELD"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("newsletter_sponsorship_slot_uq").on(
      table.listKey,
      table.issueDate,
      table.placement,
    ),
  ],
);

export const sponsoredContentProjects = sqliteTable(
  "sponsored_content_projects",
  {
    id: text("id").primaryKey(),
    sponsorshipId: text("sponsorship_id")
      .notNull()
      .references(() => sponsorships.id, { onDelete: "restrict" }),
    articleId: text("article_id").references(() => articles.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    status: text("status").notNull().default("BRIEF"),
    commercialAuthorId: text("commercial_author_id").references(() => users.id),
    reviewerId: text("reviewer_id").references(() => users.id),
    claimsReviewedAt: integer("claims_reviewed_at", { mode: "timestamp_ms" }),
    mediaRightsReviewedAt: integer("media_rights_reviewed_at", {
      mode: "timestamp_ms",
    }),
    disclosureApprovedAt: integer("disclosure_approved_at", {
      mode: "timestamp_ms",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sponsored_content_article_uq").on(table.articleId),
    index("sponsored_content_status_idx").on(table.status),
  ],
);

export const affiliateLinks = sqliteTable(
  "affiliate_links",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id").references(() => articles.id, {
      onDelete: "cascade",
    }),
    merchant: text("merchant").notNull(),
    network: text("network").notNull(),
    campaignReference: text("campaign_reference"),
    destinationUrlNormalized: text("destination_url_normalized").notNull(),
    disclosure: text("disclosure").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    lastHealthCheckAt: integer("last_health_check_at", { mode: "timestamp_ms" }),
    status: text("status").notNull().default("DISABLED"),
    ...timestamps,
  },
  (table) => [
    index("affiliate_links_article_status_idx").on(table.articleId, table.status),
  ],
);

export const membershipPlans = sqliteTable(
  "membership_plans",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("USD"),
    priceCents: integer("price_cents").notNull(),
    billingInterval: text("billing_interval").notNull(),
    entitlementsJson: text("entitlements_json").notNull().default("[]"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("membership_plans_key_uq").on(table.key),
    check("membership_plans_price_ck", sql`${table.priceCents} >= 0`),
  ],
);

export const commercialAuditLogs = sqliteTable(
  "commercial_audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id),
    advertiserOrganizationId: text("advertiser_organization_id").references(
      () => advertiserOrganizations.id,
      { onDelete: "restrict" },
    ),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    beforeHash: text("before_hash"),
    afterHash: text("after_hash"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    ipHash: text("ip_hash"),
    occurredAt,
  },
  (table) => [
    index("commercial_audit_target_idx").on(
      table.targetType,
      table.targetId,
      table.occurredAt,
    ),
    index("commercial_audit_org_idx").on(
      table.advertiserOrganizationId,
      table.occurredAt,
    ),
  ],
);

export const adKillSwitches = sqliteTable(
  "ad_kill_switches",
  {
    id: text("id").primaryKey(),
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    reason: text("reason").notNull(),
    activatedById: text("activated_by_id")
      .notNull()
      .references(() => users.id),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }).notNull(),
    releasedById: text("released_by_id").references(() => users.id),
    releasedAt: integer("released_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("ad_kill_switches_scope_uq").on(table.scopeType, table.scopeId),
  ],
);
