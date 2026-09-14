import { z } from "zod";
import { getD1Binding } from "@/db";

export const SETTINGS_CATEGORIES = [
  "general",
  "editorial",
  "ai",
  "trends",
  "audio",
  "newsletters",
  "advertising",
  "appearance",
  "integrations",
  "security",
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];
export type SettingValueType =
  | "string"
  | "number"
  | "boolean"
  | "json"
  | "string_list"
  | "secret_reference";

type SettingDefinition = {
  key: string;
  category: SettingsCategory;
  label: string;
  description: string;
  valueType: SettingValueType;
  defaultValue: unknown;
  validationSchema: string;
  schema: z.ZodType<unknown>;
  ownerOnly?: boolean;
  requiresRedeploy?: boolean;
  isSecretReference?: boolean;
};

const string = z.string().trim().min(1).max(200);
const optionalString = z.string().trim().max(300);
const nonNegativeNumber = z.number().finite().min(0);
const positiveInteger = z.number().int().min(1).max(1000);
const stringList = z.array(z.string().trim().min(1).max(100)).max(20);

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: "brand.name",
    category: "general",
    label: "Brand name",
    description: "Reader-facing publication name.",
    valueType: "string",
    defaultValue: "Northline",
    validationSchema: "string:1..200",
    schema: string,
  },
  {
    key: "site.defaultLocale",
    category: "general",
    label: "Default locale",
    description: "Default locale used for reader-facing dates and metadata.",
    valueType: "string",
    defaultValue: "en-US",
    validationSchema: "string:1..200",
    schema: string,
  },
  {
    key: "publishing.dailyNormalMax",
    category: "editorial",
    label: "Daily publishing limit",
    description: "Maximum routine stories scheduled per day.",
    valueType: "number",
    defaultValue: 10,
    validationSchema: "integer:1..1000",
    schema: positiveInteger,
  },
  {
    key: "editorial.categoryRiskRules",
    category: "editorial",
    label: "Category risk rules",
    description: "Review requirements by category. Changes require an owner.",
    valueType: "json",
    defaultValue: {},
    validationSchema: "record<string,boolean>",
    schema: z.record(z.string().max(100), z.boolean()),
    ownerOnly: true,
  },
  {
    key: "ai.providerFallbackOrder",
    category: "ai",
    label: "Provider fallback order",
    description: "Approved provider aliases used after a failed model request.",
    valueType: "string_list",
    defaultValue: ["google", "openai", "anthropic"],
    validationSchema: "string[]:1..20",
    schema: stringList,
  },
  {
    key: "ai.dailyBudgetUsd",
    category: "ai",
    label: "Daily AI budget",
    description: "Maximum approved daily spend in USD.",
    valueType: "number",
    defaultValue: 5,
    validationSchema: "number:>=0",
    schema: nonNegativeNumber.max(100_000),
    ownerOnly: true,
  },
  {
    key: "trends.refreshIntervalMinutes",
    category: "trends",
    label: "Trend refresh interval",
    description: "Minutes between approved trend checks.",
    valueType: "number",
    defaultValue: 15,
    validationSchema: "integer:1..1000",
    schema: positiveInteger,
  },
  {
    key: "trends.searchCountries",
    category: "trends",
    label: "Search countries",
    description: "Countries included in trend monitoring.",
    valueType: "string_list",
    defaultValue: ["US"],
    validationSchema: "string[]:1..20",
    schema: stringList,
  },
  {
    key: "audio.defaultVoice",
    category: "audio",
    label: "Default voice",
    description: "Approved TTS voice identifier; it is not a credential.",
    valueType: "string",
    defaultValue: "",
    validationSchema: "string:0..300",
    schema: optionalString,
  },
  {
    key: "newsletters.dailyTime",
    category: "newsletters",
    label: "Daily send time",
    description: "Local send time in 24-hour format.",
    valueType: "string",
    defaultValue: "07:00",
    validationSchema: "time:HH:MM",
    schema: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  },
  {
    key: "advertising.directRateCard",
    category: "advertising",
    label: "Direct advertising rate card",
    description: "Published sales pricing by placement.",
    valueType: "json",
    defaultValue: {},
    validationSchema: "record<string,number>",
    schema: z.record(z.string().max(100), nonNegativeNumber.max(1_000_000)),
  },
  {
    key: "appearance.articleTheme",
    category: "appearance",
    label: "Article theme",
    description: "Public article presentation mode.",
    valueType: "string",
    defaultValue: "system",
    validationSchema: "enum:light|dark|system",
    schema: z.enum(["light", "dark", "system"]),
  },
  {
    key: "integrations.emailSecretReference",
    category: "integrations",
    label: "Email credential reference",
    description: "Name of the deployment secret only; its value is never stored here.",
    valueType: "secret_reference",
    defaultValue: "EMAIL_API_KEY",
    validationSchema: "secret-reference:UPPER_SNAKE_CASE",
    schema: z.string().regex(/^[A-Z][A-Z0-9_]{2,100}$/),
    ownerOnly: true,
    isSecretReference: true,
    requiresRedeploy: true,
  },
  {
    key: "security.staffMfaRequired",
    category: "security",
    label: "Require staff MFA",
    description: "Require multi-factor enrollment before protected newsroom access.",
    valueType: "boolean",
    defaultValue: true,
    validationSchema: "boolean",
    schema: z.boolean(),
    ownerOnly: true,
  },
];

const definitionsByKey = new Map(
  SETTING_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export class SettingsRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID" | "CONFLICT" | "NOT_FOUND" | "PROTECTED",
  ) {
    super(message);
  }
}

export function isSettingsCategory(value: string): value is SettingsCategory {
  return (SETTINGS_CATEGORIES as readonly string[]).includes(value);
}

export function definitionsForCategory(category: SettingsCategory) {
  return SETTING_DEFINITIONS.filter((definition) => definition.category === category);
}

export function definitionForKey(key: string) {
  return definitionsByKey.get(key);
}

export function publicDefinitionsForCategory(category: SettingsCategory) {
  return definitionsForCategory(category).map((definition) => ({
    key: definition.key,
    label: definition.label,
    description: definition.description,
    valueType: definition.valueType,
    defaultValue: definition.isSecretReference ? undefined : definition.defaultValue,
    ownerOnly: definition.ownerOnly === true,
    requiresRedeploy: definition.requiresRedeploy === true,
    isSecretReference: definition.isSecretReference === true,
  }));
}

export function validateSettingValue(key: string, value: unknown): unknown {
  const definition = definitionForKey(key);
  if (!definition) throw new SettingsRegistryError("Unknown setting key.", "NOT_FOUND");
  const parsed = definition.schema.safeParse(value);
  if (!parsed.success) {
    throw new SettingsRegistryError("The setting value does not match its validation schema.", "INVALID");
  }
  return parsed.data;
}

export function settingRequiresOwner(key: string): boolean {
  return definitionForKey(key)?.ownerOnly === true;
}

export async function readSettingsCategory(
  category: SettingsCategory,
  environment: string,
) {
  const database = await getD1Binding();
  const stored = await database
    .prepare(
      `SELECT id, key, value_json, effective_value_json, version, updated_at
       FROM settings_registry WHERE category = ? AND environment = ?`,
    )
    .bind(category, environment)
    .all<StoredSetting>();
  const byKey = new Map((stored.results ?? []).map((setting) => [setting.key, setting]));

  return definitionsForCategory(category).map((definition) => {
    const entry = byKey.get(definition.key);
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      valueType: definition.valueType,
      value: definition.isSecretReference
        ? undefined
        : entry
          ? parseJson(entry.effective_value_json, definition.defaultValue)
          : definition.defaultValue,
      configured: Boolean(entry),
      version: entry?.version ?? 0,
      updatedAt: entry?.updated_at ?? null,
      ownerOnly: definition.ownerOnly === true,
      requiresRedeploy: definition.requiresRedeploy === true,
      isSecretReference: definition.isSecretReference === true,
    };
  });
}

export async function updateSetting({
  key,
  value,
  expectedVersion,
  reason,
  environment,
  actorId,
}: {
  key: string;
  value: unknown;
  expectedVersion: number;
  reason: string;
  environment: string;
  actorId: string;
}) {
  const definition = definitionForKey(key);
  if (!definition) throw new SettingsRegistryError("Unknown setting key.", "NOT_FOUND");
  if (definition.isSecretReference) {
    throw new SettingsRegistryError(
      "Deployment secret references are managed outside the Newsroom.",
      "PROTECTED",
    );
  }
  const validatedValue = validateSettingValue(key, value);
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 12 || trimmedReason.length > 500) {
    throw new SettingsRegistryError("Provide a change reason between 12 and 500 characters.", "INVALID");
  }

  const database = await getD1Binding();
  const existing = await database
    .prepare(
      `SELECT id, version FROM settings_registry WHERE key = ? AND environment = ? LIMIT 1`,
    )
    .bind(key, environment)
    .first<Pick<StoredSetting, "id" | "version">>();
  const now = Date.now();
  const valueJson = JSON.stringify(validatedValue);

  if (!existing) {
    if (expectedVersion !== 0) {
      throw new SettingsRegistryError("This setting was changed before it could be saved.", "CONFLICT");
    }
    const settingId = `setting_${crypto.randomUUID()}`;
    await database.batch([
      database
        .prepare(
          `INSERT INTO settings_registry
          (id, key, category, environment, value_json, value_type, is_secret_reference, validation_schema, default_value_json, effective_value_json, updated_by_id, version, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        )
        .bind(
          settingId,
          key,
          definition.category,
          environment,
          valueJson,
          definition.valueType,
          0,
          definition.validationSchema,
          JSON.stringify(definition.defaultValue),
          valueJson,
          actorId,
          now,
        ),
      database
        .prepare(
          `INSERT INTO settings_versions
          (id, setting_id, version, value_json, effective_value_json, changed_by_id, change_reason, created_at)
          VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
        )
        .bind(`setting_version_${crypto.randomUUID()}`, settingId, valueJson, valueJson, actorId, trimmedReason, now),
      database
        .prepare(
          `INSERT INTO settings_audit_log
          (id, setting_id, actor_id, action, from_version, to_version, metadata_json, occurred_at)
          VALUES (?, ?, ?, 'CREATED', NULL, 1, ?, ?)`,
        )
        .bind(
          `settings_audit_${crypto.randomUUID()}`,
          settingId,
          actorId,
          JSON.stringify({ reason: trimmedReason }),
          now,
        ),
    ]);
    return { key, version: 1, value: validatedValue, requiresRedeploy: definition.requiresRedeploy === true };
  }

  if (existing.version !== expectedVersion) {
    throw new SettingsRegistryError("This setting was changed before it could be saved.", "CONFLICT");
  }
  const nextVersion = existing.version + 1;
  const update = await database
    .prepare(
      `UPDATE settings_registry
       SET value_json = ?, effective_value_json = ?, updated_by_id = ?, version = ?, updated_at = ?
       WHERE id = ? AND version = ?`,
    )
    .bind(valueJson, valueJson, actorId, nextVersion, now, existing.id, existing.version)
    .run();
  if (!update.meta.changes) {
    throw new SettingsRegistryError("This setting was changed before it could be saved.", "CONFLICT");
  }
  await database.batch([
    database
      .prepare(
        `INSERT INTO settings_versions
        (id, setting_id, version, value_json, effective_value_json, changed_by_id, change_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(`setting_version_${crypto.randomUUID()}`, existing.id, nextVersion, valueJson, valueJson, actorId, trimmedReason, now),
    database
      .prepare(
        `INSERT INTO settings_audit_log
        (id, setting_id, actor_id, action, from_version, to_version, metadata_json, occurred_at)
        VALUES (?, ?, ?, 'UPDATED', ?, ?, ?, ?)`,
      )
      .bind(
        `settings_audit_${crypto.randomUUID()}`,
        existing.id,
        actorId,
        existing.version,
        nextVersion,
        JSON.stringify({ reason: trimmedReason }),
        now,
      ),
  ]);
  return { key, version: nextVersion, value: validatedValue, requiresRedeploy: definition.requiresRedeploy === true };
}

export async function rollbackSetting({
  key,
  toVersion,
  expectedVersion,
  reason,
  environment,
  actorId,
}: {
  key: string;
  toVersion: number;
  expectedVersion: number;
  reason: string;
  environment: string;
  actorId: string;
}) {
  const database = await getD1Binding();
  const current = await database
    .prepare(
      `SELECT id, version FROM settings_registry WHERE key = ? AND environment = ? LIMIT 1`,
    )
    .bind(key, environment)
    .first<Pick<StoredSetting, "id" | "version">>();
  if (!current) throw new SettingsRegistryError("The setting has no stored history.", "NOT_FOUND");
  if (current.version !== expectedVersion) {
    throw new SettingsRegistryError("This setting was changed before it could be restored.", "CONFLICT");
  }
  const target = await database
    .prepare(
      `SELECT value_json FROM settings_versions WHERE setting_id = ? AND version = ? LIMIT 1`,
    )
    .bind(current.id, toVersion)
    .first<{ value_json: string }>();
  if (!target) throw new SettingsRegistryError("The requested version was not found.", "NOT_FOUND");
  return updateSetting({
    key,
    value: parseJson(target.value_json, undefined),
    expectedVersion,
    reason: `Rollback to version ${toVersion}: ${reason}`,
    environment,
    actorId,
  });
}

export type IntegrationSummary = {
  integration: string;
  state: "Configured" | "Missing" | "Disabled" | "Failed";
  lastTestedAt: number | null;
  lastSuccessAt: number | null;
  lastErrorCategory: string | null;
};

export function integrationSummaries(
  environment: Record<string, string | undefined> = process.env,
): IntegrationSummary[] {
  const configured = (...keys: string[]) => keys.every((key) => Boolean(environment[key]?.trim()));
  const enabled = (key: string) => environment[key] === "true";
  return [
    {
      integration: "OpenAI",
      state: configured("OPENAI_API_KEY") ? "Configured" : "Missing",
      lastTestedAt: null,
      lastSuccessAt: null,
      lastErrorCategory: null,
    },
    {
      integration: "Anthropic",
      state: configured("ANTHROPIC_API_KEY") ? "Configured" : "Missing",
      lastTestedAt: null,
      lastSuccessAt: null,
      lastErrorCategory: null,
    },
    {
      integration: "Google AI",
      state: configured("GOOGLE_AI_API_KEY") ? "Configured" : "Missing",
      lastTestedAt: null,
      lastSuccessAt: null,
      lastErrorCategory: null,
    },
    {
      integration: "Google OAuth",
      state: configured("AUTH_OAUTH_GOOGLE_CLIENT_ID", "AUTH_OAUTH_GOOGLE_CLIENT_SECRET") ? "Configured" : "Missing",
      lastTestedAt: null,
      lastSuccessAt: null,
      lastErrorCategory: null,
    },
    {
      integration: "Cloudflare Access",
      state: !enabled("CLOUDFLARE_ACCESS_ENABLED")
        ? "Disabled"
        : configured("CLOUDFLARE_ACCESS_AUD", "CLOUDFLARE_ACCESS_TEAM_DOMAIN")
          ? "Configured"
          : "Missing",
      lastTestedAt: null,
      lastSuccessAt: null,
      lastErrorCategory: null,
    },
    {
      integration: "Email",
      state: configured("EMAIL_PROVIDER", "EMAIL_API_KEY") ? "Configured" : "Missing",
      lastTestedAt: null,
      lastSuccessAt: null,
      lastErrorCategory: null,
    },
  ];
}

type StoredSetting = {
  id: string;
  key: string;
  value_json: string;
  effective_value_json: string;
  version: number;
  updated_at: number;
};

function parseJson(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}
