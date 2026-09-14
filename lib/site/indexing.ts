import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  indexingChanges,
  siteSettings,
} from "../../db/schema-v3-operations";

export type IndexingEnvironment = {
  APP_ENV?: string;
  DEMO_CONTENT_MODE?: string;
  ENABLE_SEARCH_INDEXING?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

/**
 * The last owner decision this isolate actually managed to read from D1.
 *
 * A transient D1 read failure used to be indistinguishable from "the owner
 * never turned indexing on" - both returned false, which meant a single blip
 * on any request that happened to render robots.txt, a sitemap, or the layout
 * meta tag could serve Google `Disallow: /` for a fully live, owner-approved
 * site. The environment gate above is the real, instant, owner-controlled
 * kill switch; the database only ever adds a second confirmation on top of
 * it, so a failure to *read* that confirmation should fall back to the last
 * one this isolate actually saw, not silently become a refusal.
 *
 * A cold isolate starts with no cached decision, which correctly keeps a
 * brand-new deployment non-indexable until the owner's first real decision is
 * read - the one case where "unknown" must still mean false.
 */
let lastKnownGoodDecision: boolean | null = null;

/**
 * Decides what to report given a database read that may have failed.
 *
 * Pulled out of `isSearchIndexingEnabled` so the fallback behaviour - the
 * actual bug - is directly testable without a database at all.
 */
export function resolveIndexingDecision(
  read: { ok: true; enabled: boolean } | { ok: false },
  cached: boolean | null,
): boolean {
  if (read.ok) return read.enabled;
  return cached ?? false;
}

/**
 * Indexing requires an environment gate and an audited owner decision stored
 * in D1. A missing, malformed, preview, or demo environment is always false;
 * a database read that fails falls back to the last decision this isolate
 * successfully read, not to false.
 */
export async function isSearchIndexingEnabled(
  environment: IndexingEnvironment = process.env as IndexingEnvironment,
): Promise<boolean> {
  if (
    environment.APP_ENV !== "production" ||
    environment.ENABLE_SEARCH_INDEXING !== "true" ||
    environment.DEMO_CONTENT_MODE === "true" ||
    !isFinalHttpsOrigin(environment.NEXT_PUBLIC_SITE_URL)
  ) {
    return false;
  }
  let read: { ok: true; enabled: boolean } | { ok: false };
  try {
    const db = await getDb();
    const [setting] = await db
      .select({ valueJson: siteSettings.valueJson })
      .from(siteSettings)
      .where(eq(siteSettings.key, "search_indexing"))
      .limit(1);
    const [decision] = await db
      .select({
        enabled: indexingChanges.enabled,
        environment: indexingChanges.environment,
      })
      .from(indexingChanges)
      .orderBy(desc(indexingChanges.occurredAt))
      .limit(1);
    read = {
      ok: true,
      enabled:
        readEnabled(setting?.valueJson) &&
        decision?.enabled === true &&
        decision.environment === "production",
    };
  } catch {
    read = { ok: false };
  }
  const resolved = resolveIndexingDecision(read, lastKnownGoodDecision);
  if (read.ok) lastKnownGoodDecision = resolved;
  return resolved;
}

export function indexingEnvironmentGate(
  environment: IndexingEnvironment,
): boolean {
  return (
    environment.APP_ENV === "production" &&
    environment.ENABLE_SEARCH_INDEXING === "true" &&
    environment.DEMO_CONTENT_MODE !== "true" &&
    isFinalHttpsOrigin(environment.NEXT_PUBLIC_SITE_URL)
  );
}

function readEnabled(value: string | undefined): boolean {
  try {
    const parsed = JSON.parse(value ?? "") as { enabled?: unknown };
    return parsed.enabled === true;
  } catch {
    return false;
  }
}

function isFinalHttpsOrigin(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname !== "localhost" &&
      !url.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}
