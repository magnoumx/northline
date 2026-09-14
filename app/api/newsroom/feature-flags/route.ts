import { authorizeEditorialRequest } from "@/lib/newsroom/editorial-api-security";

export const runtime = "edge";

type Flag = {
  key: string;
  enabled: boolean;
  group: string;
  note: string;
  launchGate?: string;
};

export async function GET(): Promise<Response> {
  const access = await authorizeEditorialRequest(["settings.manage", "audit.view"]);
  if (!access.allowed) return access.response;

  const flags: Flag[] = [
    flag("FEATURE_EDITORIAL_WRITES", "Editorial", "Protected article and source mutations."),
    flag("FEATURE_DURABLE_JOBS", "Operations", "Queue-backed background jobs."),
    flag("FEATURE_SCHEDULED_INGESTION", "Discovery", "Cron-based trend refresh."),
    flag("FEATURE_TREND_CONNECTORS", "Discovery", "Google Trends and GDELT connectors."),
    flag("FEATURE_OBJECT_STORAGE", "Media", "R2-backed media workflows."),
    flag("FEATURE_INTERNAL_LINKS", "Editorial", "Internal-link recommendations."),
    flag("FEATURE_EMAIL_DELIVERY", "Distribution", "Transactional and newsletter email."),
    flag("FEATURE_MONITORING", "Operations", "Sentry error and security reporting."),
    flag("FEATURE_BACKUPS", "Operations", "Encrypted backup and restore workflow.", "Verified backup and restore drill"),
    flag("AI_ENABLED", "AI", "AI editorial runtime master switch."),
    inverseFlag("AI_GLOBAL_KILL", "AI", "AI global kill switch is not active."),
    flag("AI_ANTHROPIC_ENABLED", "AI", "Anthropic provider."),
    flag("AI_GOOGLE_ENABLED", "AI", "Google AI provider."),
    flag("AI_OPENAI_ENABLED", "AI", "OpenAI provider."),
    flag(
      "FEATURE_AUTONOMOUS_NEWSROOM",
      "AI",
      "Trend-to-draft autonomous newsroom queue.",
      "Independent review, evidence, cost, and risk gates",
    ),
    flag(
      "AUTONOMOUS_SYSTEM_APPROVAL",
      "Publishing",
      "System approval after deterministic low-risk quality gates.",
      "Successful preview batch and audit review",
    ),
    flag("FEATURE_AUTO_PUBLISH", "Publishing", "Approved-only scheduled publication.", "Successful manual end-to-end publication"),
    flag("AUTO_PUBLISH_READINESS_APPROVED", "Publishing", "Owner readiness approval for auto-publish.", "Successful manual end-to-end publication"),
    flag("ENABLE_SEARCH_INDEXING", "SEO", "Public search indexing.", "Production domain and real published content"),
    flag("ROBOTS_ALLOW_INDEXING", "SEO", "robots.txt allows indexing.", "Production domain and real published content"),
    flag("FEATURE_ADSENSE", "Advertising", "Google AdSense rendering.", "AdSense domain approval"),
    inverseFlag("AD_GLOBAL_KILL", "Advertising", "Global advertising kill switch is not active.", "Approved campaigns or AdSense account"),
    flag("FEATURE_DIRECT_ADS", "Advertising", "Direct advertising delivery.", "Approved advertiser campaign"),
    flag("FEATURE_POLITICAL_ADS", "Advertising", "Political advertising.", "Legal, identity, targeting, and disclosure controls"),
    flag("FEATURE_ARTICLE_AUDIO", "Audio", "Generated article audio.", "Verified TTS provider and budget"),
  ];

  return Response.json(
    { flags, generatedAt: new Date().toISOString() },
    { headers: { "cache-control": "private, no-store" } },
  );
}

function flag(
  key: string,
  group: string,
  note: string,
  launchGate?: string,
): Flag {
  return {
    key,
    enabled: process.env[key] === "true",
    group,
    note,
    launchGate,
  };
}

function inverseFlag(
  key: string,
  group: string,
  note: string,
  launchGate?: string,
): Flag {
  return {
    key,
    enabled: process.env[key] === "false",
    group,
    note,
    launchGate,
  };
}
