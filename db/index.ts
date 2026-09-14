import { drizzle } from "drizzle-orm/d1";
import * as editorialSchema from "./schema";
import * as v2Schema from "./schema-v2";
import * as v3AiSchema from "./schema-v3-ai";
import * as v3AuthSchema from "./schema-v3-auth";
import * as v3ContentSchema from "./schema-v3-content";
import * as v3OperationsSchema from "./schema-v3-operations";
import * as v4AudioSchema from "./schema-v4-audio";
import * as v4IntelligenceSchema from "./schema-v4-intelligence";
import * as v7SettingsSchema from "./schema-v7-settings";

const schema = {
  ...editorialSchema,
  ...v2Schema,
  ...v3ContentSchema,
  ...v3AiSchema,
  ...v3AuthSchema,
  ...v3OperationsSchema,
  ...v4AudioSchema,
  ...v4IntelligenceSchema,
  ...v7SettingsSchema,
};

export async function getDb() {
  // Resolve the platform binding only when a persistence-backed route runs.
  // This keeps read-only rendering and unit tests independent of Cloudflare.
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function getD1Binding(): Promise<D1Database> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }
  return env.DB;
}

/** Returns null rather than throwing so a missing bucket renders a 404. */
export async function getR2Binding(
  binding: "MEDIA" | "ARTICLE_AUDIO" | "MEDIA_QUARANTINE",
): Promise<R2Bucket | null> {
  const { env } = await import("cloudflare:workers");
  const bucket = (env as unknown as Record<string, unknown>)[binding];
  return (bucket as R2Bucket | undefined) ?? null;
}
