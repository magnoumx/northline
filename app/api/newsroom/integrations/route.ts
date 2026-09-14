import { authorizeEditorialRequest } from "@/lib/newsroom/editorial-api-security";

export const runtime = "edge";

type Integration = {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  requiredValues: string[];
  note: string;
};

export async function GET(): Promise<Response> {
  const access = await authorizeEditorialRequest(["workspace.access", "settings.manage", "audit.view"]);
  if (!access.allowed) return access.response;

  const integrations: Integration[] = [
    integration("cloudflare-access", "Cloudflare Access", process.env.CLOUDFLARE_ACCESS_ENABLED === "true", ["CLOUDFLARE_ACCESS_AUD", "CLOUDFLARE_ACCESS_TEAM_DOMAIN"], "Protects newsroom.usnorthline.com and supplies the verified staff identity."),
    integration("turnstile", "Cloudflare Turnstile", process.env.CAPTCHA_REQUIRED === "true", ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"], "Protects public mutation forms."),
    integration("email", "Email delivery", process.env.FEATURE_EMAIL_DELIVERY === "true", ["EMAIL_PROVIDER", "EMAIL_API_KEY", "EMAIL_FROM_ADDRESS"], "Required for newsletters and standard magic-link authentication."),
    integration("google-ai", "Google AI", process.env.AI_GOOGLE_ENABLED === "true", ["GOOGLE_AI_API_KEY", "AI_GOOGLE_MODEL"], "Low-cost classification, extraction, and approved editorial tasks."),
    integration("openai", "OpenAI", process.env.AI_OPENAI_ENABLED === "true", ["OPENAI_API_KEY", "AI_OPENAI_MODEL"], "Optional independent review, research synthesis, and TTS."),
    integration("anthropic", "Anthropic", process.env.AI_ANTHROPIC_ENABLED === "true", ["ANTHROPIC_API_KEY", "AI_ANTHROPIC_MODEL"], "Drafting, research synthesis, copy review, and approved editorial tasks."),
    integration("google-trends", "Google Trends", process.env.TREND_GOOGLE_ENABLED === "true", [], "Official U.S. Trending Now RSS discovery; no API key is required."),
    integration("gdelt", "GDELT", process.env.TREND_GDELT_ENABLED === "true", [], "Public GDELT document discovery; no API key is required and every resulting claim still requires verification."),
    integration("r2", "R2 object storage", process.env.FEATURE_OBJECT_STORAGE === "true", [], "Provided through MEDIA, MEDIA_QUARANTINE, and ARTICLE_AUDIO bindings."),
    integration("queues", "Cloudflare Queues", process.env.FEATURE_DURABLE_JOBS === "true", [], "Provided through Worker queue bindings and consumers."),
    integration("monitoring", "Monitoring", process.env.FEATURE_MONITORING === "true", ["SENTRY_DSN"], "Error and security-event reporting."),
    integration("backups", "Encrypted backups", process.env.FEATURE_BACKUPS === "true", ["BACKUP_ENCRYPTION_KEY", "BACKUP_BUCKET"], "Production backup and restore workflow."),
  ];

  return Response.json(
    { integrations, generatedAt: new Date().toISOString() },
    { headers: { "cache-control": "private, no-store" } },
  );
}

function integration(
  id: string,
  label: string,
  enabled: boolean,
  requiredValues: string[],
  note: string,
): Integration {
  return {
    id,
    label,
    enabled,
    configured: requiredValues.every((key) => Boolean(process.env[key]?.trim())),
    requiredValues,
    note,
  };
}
