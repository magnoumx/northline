import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const authProvider = process.env.AUTH_PROVIDER?.trim().toLowerCase() || "standard";
  const cloudflareAccessConfigured =
    authProvider === "cloudflare_access" &&
    process.env.CLOUDFLARE_ACCESS_ENABLED === "true" &&
    Boolean(process.env.CLOUDFLARE_ACCESS_AUD?.trim()) &&
    Boolean(process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim());
  const standardAuthenticationConfigured =
    authProvider === "standard" &&
    process.env.AUTH_MAGIC_LINK_ENABLED === "true";
  const staffMfaConfigured =
    process.env.AUTH_STAFF_MFA_REQUIRED === "true" &&
    ((authProvider === "cloudflare_access" &&
      process.env.AUTH_MFA_PROVIDER === "cloudflare_access") ||
      (authProvider === "standard" &&
        Boolean(process.env.AUTH_MFA_PROVIDER?.trim())));

  const checks: Record<string, boolean> = {
    production_environment: process.env.APP_ENV === "production",
    final_https_origin: finalHttpsOrigin(
      process.env.NEXT_PUBLIC_SITE_URL,
      request.url,
    ),
    demo_content_disabled: process.env.DEMO_CONTENT_MODE !== "true",
    authentication:
      standardAuthenticationConfigured || cloudflareAccessConfigured,
    staff_mfa: staffMfaConfigured,
    email_delivery: process.env.FEATURE_EMAIL_DELIVERY === "true",
    durable_jobs: process.env.FEATURE_DURABLE_JOBS === "true",
    object_storage: process.env.FEATURE_OBJECT_STORAGE === "true",
    discovery_sources:
      process.env.FEATURE_SOURCE_ACQUISITION === "true" ||
      (process.env.FEATURE_TREND_CONNECTORS === "true" &&
        process.env.CONNECTORS_ENABLED === "true" &&
        process.env.CONNECTORS_GLOBAL_KILL === "false" &&
        (process.env.TREND_GOOGLE_ENABLED === "true" ||
          process.env.TREND_GDELT_ENABLED === "true")),
    connectors:
      process.env.CONNECTORS_ENABLED === "true" &&
      process.env.CONNECTORS_GLOBAL_KILL === "false",
    ai_runtime:
      process.env.AI_ENABLED === "true" &&
      process.env.AI_GLOBAL_KILL === "false",
    monitoring: process.env.FEATURE_MONITORING === "true",
    backups: process.env.FEATURE_BACKUPS === "true",
    publication_controlled:
      process.env.FEATURE_AUTO_PUBLISH !== "true" ||
      (process.env.AUTO_PUBLISH_READINESS_APPROVED === "true" &&
        process.env.AUTO_PUBLISH_MODE === "approved_only" &&
        validDailyPublishLimit(process.env.AUTO_PUBLISH_DAILY_LIMIT)),
    adsense_safe_configuration:
      process.env.FEATURE_ADSENSE !== "true" ||
      (process.env.AD_GLOBAL_KILL === "false" &&
        /^ca-pub-\d{10,30}$/u.test(process.env.ADSENSE_CLIENT_ID ?? "")),
    search_launch_controlled:
      process.env.ENABLE_SEARCH_INDEXING !== "true" ||
      (process.env.GOOGLE_SEARCH_LAUNCH_APPROVED === "true" &&
        (process.env.GOOGLE_SEARCH_VERIFICATION_METHOD === "dns" ||
          Boolean(process.env.GOOGLE_SITE_VERIFICATION?.trim()))),
  };
  try {
    const db = await getDb();
    await db.run(sql`SELECT 1`);
    checks.database = true;
    const result = await db.get<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM articles WHERE state IN ('PUBLISHED','DEVELOPING','UPDATED','CORRECTED')`,
    );
    const count = Number(result?.count ?? 0);
    const minimumStories = boundedStoryFloor(
      process.env.SEO_MINIMUM_REAL_STORIES,
    );
    checks.real_content_floor = count >= minimumStories;
  } catch {
    checks.database = false;
    checks.real_content_floor = false;
  }
  const ready = Object.values(checks).every(Boolean);
  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      check: "production_readiness",
      service: "northline-web",
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

function finalHttpsOrigin(configured: string | undefined, requestUrl: string) {
  try {
    const url = new URL(configured ?? requestUrl);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname !== "localhost"
    );
  } catch {
    return false;
  }
}

function validDailyPublishLimit(value: string | undefined): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 25;
}

function boundedStoryFloor(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 5 && parsed <= 200 ? parsed : 20;
}
