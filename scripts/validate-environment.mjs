import "./lib/load-env.mjs";
const env = process.env;
const errors = [];
const environment = env.APP_ENV ?? "development";
const allowedEnvironments = new Set(["development", "test", "preview", "production"]);
if (!allowedEnvironments.has(environment)) {
  errors.push("APP_ENV must be development, test, preview, or production.");
}

const featureFlags = [
  "AD_GLOBAL_KILL",
  "FEATURE_DIRECT_ADS",
  "FEATURE_ADVERTISER_PORTAL",
  "FEATURE_ADSENSE",
  "FEATURE_GOOGLE_AD_MANAGER",
  "FEATURE_SPONSORED_CONTENT",
  "FEATURE_AFFILIATE_LINKS",
  "FEATURE_PAID_MEMBERSHIP",
  "FEATURE_AUTO_PUBLISH",
  "GOOGLE_SEARCH_LAUNCH_APPROVED",
  "FEATURE_EDITORIAL_WRITES",
  "FEATURE_DURABLE_JOBS",
  "FEATURE_OBJECT_STORAGE",
  "FEATURE_ARTICLE_AUDIO",
  "FEATURE_SOURCE_ACQUISITION",
  "FEATURE_TREND_CONNECTORS",
  "FEATURE_EMAIL_DELIVERY",
  "FEATURE_MONITORING",
  "FEATURE_SCHEDULED_INGESTION",
  "FEATURE_BACKUPS",
  "AI_ENABLED",
  "AI_GLOBAL_KILL",
  "AUTH_MAGIC_LINK_ENABLED",
  "AUTH_OAUTH_GOOGLE_ENABLED",
  "ADMIN_BOOTSTRAP_ENABLED",
  "AUTH_ALLOW_REGISTRATION",
  "AUTH_STAFF_MFA_REQUIRED",
  "CONNECTORS_ENABLED",
  "CONNECTORS_GLOBAL_KILL",
  "TREND_GDELT_ENABLED",
  "TREND_GOOGLE_ENABLED",
  "TREND_RSS_ENABLED",
  "SEARCH_CONNECTOR_ENABLED",
  "AI_OPENAI_ENABLED",
  "AI_ANTHROPIC_ENABLED",
  "AI_ANTHROPIC_WEB_SEARCH_ENABLED",
  "AI_GOOGLE_ENABLED",
  "AI_LOCAL_ENABLED",
  "ARTICLE_AUDIO_GLOBAL_KILL",
  "ARTICLE_AUDIO_PLAYBACK_ENABLED",
  "BROWSER_SPEECH_FALLBACK_ENABLED",
  "ARTICLE_AUDIO_DOWNLOAD_ALLOWED",
  "TTS_OPENAI_ENABLED",
  "TTS_GOOGLE_ENABLED",
  "TTS_ELEVENLABS_ENABLED",
];
for (const key of featureFlags) {
  if (env[key] !== undefined && env[key] !== "true" && env[key] !== "false") {
    errors.push(`${key} must be true or false.`);
  }
}

if (environment === "production") {
  if (env.DEMO_CONTENT_MODE === "true") {
    errors.push("DEMO_CONTENT_MODE must be false in production.");
  }
  requireHttpsUrl("NEXT_PUBLIC_SITE_URL");
  requireSecret("RATE_LIMIT_SECRET");
  requireSecret("NEWSLETTER_CONFIRMATION_SECRET");
  requireSecret("NEWSLETTER_UNSUBSCRIBE_SECRET");

  const provider = (env.AUTH_PROVIDER ?? "standard").trim().toLowerCase();
  if (provider !== "standard" && provider !== "cloudflare_access") {
    errors.push(
      "AUTH_PROVIDER must be standard or cloudflare_access in production; trusted_proxy is preview/test-only.",
    );
  }
  if (env.AUTH_TRUSTED_PROXY_MODE === "true") {
    errors.push("AUTH_TRUSTED_PROXY_MODE must be false in production.");
  }
  if (provider === "standard") {
    requireSecret("AUTH_SESSION_SECRET");
  } else {
    if (!enabled("CLOUDFLARE_ACCESS_ENABLED")) {
      errors.push("AUTH_PROVIDER=cloudflare_access requires CLOUDFLARE_ACCESS_ENABLED=true.");
    }
    requireValue("CLOUDFLARE_ACCESS_AUD");
    requireValue("CLOUDFLARE_ACCESS_TEAM_DOMAIN");
  }

  if (env.CAPTCHA_REQUIRED !== "false") {
    requireValue("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    requireSecret("TURNSTILE_SECRET_KEY");
  }
}

if (env.ENABLE_SEARCH_INDEXING === "true") {
  if (env.GOOGLE_SEARCH_LAUNCH_APPROVED !== "true") {
    errors.push("ENABLE_SEARCH_INDEXING requires GOOGLE_SEARCH_LAUNCH_APPROVED=true after the launch review.");
  }
  requireValue("GOOGLE_SITE_VERIFICATION");
}

if (enabled("FEATURE_DIRECT_ADS")) {
  requireSecret("AD_TOKEN_SECRET");
  requireSecret("AD_EVENT_HASH_SECRET");
  requireValue("AD_APPROVED_DESTINATION_HOSTS");
}
if (enabled("FEATURE_ADVERTISER_PORTAL")) {
  const provider = env.AUTH_PROVIDER ?? "standard";
  if (provider === "standard") requireSecret("AUTH_SESSION_SECRET");
  if (environment === "production") requireSecret("CSRF_SECRET");
}
if (enabled("FEATURE_ADSENSE")) {
  if (env.AD_GLOBAL_KILL !== "false") {
    errors.push("FEATURE_ADSENSE requires AD_GLOBAL_KILL=false.");
  }
  const adsenseClientId = env.ADSENSE_CLIENT_ID?.trim() ?? "";
  if (!/^ca-pub-\d{10,30}$/u.test(adsenseClientId)) {
    errors.push("ADSENSE_CLIENT_ID must use the ca-pub-<digits> format.");
  }
}
if (enabled("FEATURE_GOOGLE_AD_MANAGER")) {
  requireValue("GOOGLE_AD_MANAGER_NETWORK_CODE");
}
if (enabled("FEATURE_SPONSORED_CONTENT")) {
  requireValue("MALWARE_SCANNER_PROVIDER");
}
if (enabled("FEATURE_AFFILIATE_LINKS")) {
  requireSecret("AD_EVENT_HASH_SECRET");
  requireValue("AD_APPROVED_DESTINATION_HOSTS");
}
if (enabled("FEATURE_PAID_MEMBERSHIP")) {
  if (!env.PAYMENT_PROVIDER || env.PAYMENT_PROVIDER === "manual") {
    errors.push("PAYMENT_PROVIDER must be configured for paid membership.");
  }
  requireValue("INVOICE_LEGAL_NAME");
  requireValue("INVOICE_ADDRESS");
}
if (env.PAYMENT_PROVIDER === "stripe") {
  requireSecret("STRIPE_SECRET_KEY");
  requireSecret("STRIPE_WEBHOOK_SECRET");
}
if (enabled("FEATURE_AUTO_PUBLISH")) {
  if (env.AUTO_PUBLISH_READINESS_APPROVED !== "true") {
    errors.push(
      "FEATURE_AUTO_PUBLISH requires AUTO_PUBLISH_READINESS_APPROVED=true after the documented safety gates.",
    );
  }
  if (env.AUTO_PUBLISH_MODE !== "approved_only") {
    errors.push(
      "FEATURE_AUTO_PUBLISH only supports AUTO_PUBLISH_MODE=approved_only. AI-created drafts must still receive human approval.",
    );
  }
  requireBoundedInteger("AUTO_PUBLISH_DAILY_LIMIT", 1, 25);
  requireValue("AUTO_PUBLISH_ALLOWED_CATEGORIES");
  requireValue("AUTO_PUBLISH_ALLOWED_FORMATS");
  if (!enabled("FEATURE_DURABLE_JOBS") || !enabled("FEATURE_SCHEDULED_INGESTION")) {
    errors.push(
      "Approved-only automatic publication requires FEATURE_DURABLE_JOBS=true and FEATURE_SCHEDULED_INGESTION=true.",
    );
  }
}
if (enabled("FEATURE_EDITORIAL_WRITES")) {
  const authProvider = (env.AUTH_PROVIDER ?? "standard").trim().toLowerCase();
  if (authProvider === "standard") {
    if (!enabled("AUTH_MAGIC_LINK_ENABLED")) {
      errors.push("FEATURE_EDITORIAL_WRITES with standard auth requires AUTH_MAGIC_LINK_ENABLED=true.");
    }
  } else if (authProvider === "cloudflare_access") {
    if (!enabled("CLOUDFLARE_ACCESS_ENABLED")) {
      errors.push("FEATURE_EDITORIAL_WRITES with cloudflare_access requires CLOUDFLARE_ACCESS_ENABLED=true.");
    }
  } else {
    errors.push("FEATURE_EDITORIAL_WRITES requires standard or cloudflare_access authentication.");
  }
  requireSecret("CSRF_SECRET");
}

if (enabled("CLOUDFLARE_ACCESS_ENABLED")) {
  requireValue("CLOUDFLARE_ACCESS_AUD");
  requireValue("CLOUDFLARE_ACCESS_TEAM_DOMAIN");
}

if (enabled("AI_ENABLED") && env.AI_GLOBAL_KILL === "false") {
  const providerContracts = [
    ["AI_OPENAI_ENABLED", "OPENAI_API_KEY", "AI_OPENAI_MODEL", "AI_OPENAI_INPUT_USD_PER_MILLION_TOKENS", "AI_OPENAI_OUTPUT_USD_PER_MILLION_TOKENS", "AI_OPENAI_TIER", true],
    ["AI_ANTHROPIC_ENABLED", "ANTHROPIC_API_KEY", "AI_ANTHROPIC_MODEL", "AI_ANTHROPIC_INPUT_USD_PER_MILLION_TOKENS", "AI_ANTHROPIC_OUTPUT_USD_PER_MILLION_TOKENS", "AI_ANTHROPIC_TIER", true],
    ["AI_GOOGLE_ENABLED", "GOOGLE_AI_API_KEY", "AI_GOOGLE_MODEL", "AI_GOOGLE_INPUT_USD_PER_MILLION_TOKENS", "AI_GOOGLE_OUTPUT_USD_PER_MILLION_TOKENS", "AI_GOOGLE_TIER", true],
    ["AI_LOCAL_ENABLED", "AI_LOCAL_API_KEY", "AI_LOCAL_MODEL", "AI_LOCAL_INPUT_USD_PER_MILLION_TOKENS", "AI_LOCAL_OUTPUT_USD_PER_MILLION_TOKENS", "AI_LOCAL_TIER", false],
  ];
  let configuredProviders = 0;
  for (const [enabledKey, key, model, inputPrice, outputPrice, tier, requiresSecret] of providerContracts) {
    if (!enabled(enabledKey)) continue;
    configuredProviders += 1;
    if (requiresSecret) requireSecret(key);
    requireValue(model);
    requireNonNegativeNumber(inputPrice);
    requireNonNegativeNumber(outputPrice);
    if (env[tier] !== "paid" && env[tier] !== "free") {
      errors.push(`${tier} must be paid or free for an enabled provider.`);
    }
    if (enabledKey === "AI_LOCAL_ENABLED") requireSafeLocalAiUrl("AI_LOCAL_ENDPOINT");
  }
  if (configuredProviders === 0) {
    errors.push("Operational AI requires at least one explicitly enabled provider.");
  }
  if (enabled("AI_ANTHROPIC_WEB_SEARCH_ENABLED")) {
    if (!enabled("AI_ANTHROPIC_ENABLED")) {
      errors.push("AI_ANTHROPIC_WEB_SEARCH_ENABLED requires AI_ANTHROPIC_ENABLED=true.");
    }
    requireBoundedInteger("AI_ANTHROPIC_WEB_SEARCH_MAX_USES", 1, 10);
  }
  requirePositiveNumber("AI_DAILY_BUDGET_USD");
  requirePositiveNumber("AI_MONTHLY_BUDGET_USD");
  requirePositiveNumber("AI_PER_STORY_BUDGET_USD");
  requirePositiveNumber("AI_PER_TASK_BUDGET_USD");
  requirePositiveInteger("AI_MAX_CONTEXT_TOKENS");
  requirePositiveInteger("AI_MAX_OUTPUT_TOKENS");
  requirePositiveInteger("AI_MAX_REVISIONS");
  requirePositiveInteger("AI_MAX_CONCURRENT_JOBS");
  requirePositiveInteger("AI_MAX_RETRIES", true);
  requireValue("AI_PROMPT_VERSION");
  requireValue("AI_POLICY_VERSION");
}


if (enabled("AUTH_OAUTH_GOOGLE_ENABLED")) {
  requireValue("AUTH_OAUTH_GOOGLE_CLIENT_ID");
  requireSecret("AUTH_OAUTH_GOOGLE_CLIENT_SECRET");
}
if (enabled("ADMIN_BOOTSTRAP_ENABLED")) {
  requireValue("ADMIN_BOOTSTRAP_USERNAME");
  requireValue("ADMIN_BOOTSTRAP_EMAIL");
  const token = env.ADMIN_BOOTSTRAP_TOKEN?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/iu.test(token)) {
    errors.push("ADMIN_BOOTSTRAP_TOKEN must be exactly 64 hexadecimal characters.");
  }
}

if (enabled("AUTH_MAGIC_LINK_ENABLED")) {
  if ((env.AUTH_PROVIDER ?? "standard") !== "standard") {
    errors.push("AUTH_MAGIC_LINK_ENABLED requires AUTH_PROVIDER=standard.");
  }
  requireSecret("AUTH_SESSION_SECRET");
  if (!enabled("FEATURE_EMAIL_DELIVERY")) {
    errors.push("AUTH_MAGIC_LINK_ENABLED requires FEATURE_EMAIL_DELIVERY=true.");
  }
  requireValue("EMAIL_PROVIDER");
  requireSecret("EMAIL_API_KEY");
  requireValue("EMAIL_FROM_ADDRESS");
  if (environment === "production") {
    if (!enabled("AUTH_STAFF_MFA_REQUIRED")) {
      errors.push("Production standard authentication requires AUTH_STAFF_MFA_REQUIRED=true.");
    }
    requireValue("AUTH_MFA_PROVIDER");
  }
}

if (enabled("FEATURE_OBJECT_STORAGE")) {
  requireValue("MALWARE_SCANNER_PROVIDER");
  // D1/R2/Queue resources are runtime bindings declared and checked in wrangler.jsonc.
}
if (
  enabled("FEATURE_ARTICLE_AUDIO") &&
  env.ARTICLE_AUDIO_GLOBAL_KILL === "false"
) {
  if (env.DEMO_CONTENT_MODE === "true") {
    errors.push(
      "Operational article audio is disabled while DEMO_CONTENT_MODE=true.",
    );
  }
  if (!enabled("FEATURE_DURABLE_JOBS")) {
    errors.push(
      "Operational article audio requires FEATURE_DURABLE_JOBS=true.",
    );
  }
  if (!enabled("FEATURE_OBJECT_STORAGE")) {
    errors.push(
      "Operational article audio requires FEATURE_OBJECT_STORAGE=true.",
    );
  }
  requireValue("ARTICLE_AUDIO_BUCKET");
  if (env.ARTICLE_AUDIO_R2_BINDING !== "ARTICLE_AUDIO") {
    errors.push(
      "ARTICLE_AUDIO_R2_BINDING must be ARTICLE_AUDIO for the audited stream route.",
    );
  }
  requireValue("ARTICLE_AUDIO_STORAGE_PREFIX");
  requireValue("ARTICLE_AUDIO_QUEUE_NAME");
  requireValue("TTS_PROVIDER_ORDER");
  requireValue("TTS_NARRATION_POLICY_VERSION");
  requirePositiveNumber("TTS_DAILY_BUDGET_USD");
  requirePositiveNumber("TTS_PER_ARTICLE_BUDGET_USD");
  requireBoundedInteger("TTS_MAX_ARTICLE_CHARACTERS", 500, 200000);
  requireBoundedInteger("TTS_REGENERATION_COOLDOWN", 60, 2592000);
  requireBoundedInteger("TTS_CHUNK_MAX_CHARACTERS", 250, 4000);
  const format = env.TTS_OUTPUT_FORMAT?.trim().toUpperCase();
  if (!["MP3", "OPUS", "AAC", "FLAC", "WAV", "PCM"].includes(format)) {
    errors.push(
      "TTS_OUTPUT_FORMAT must be MP3, OPUS, AAC, FLAC, WAV, or PCM.",
    );
  }
  const ttsProviders = [
    [
      "TTS_OPENAI_ENABLED",
      "OPENAI_API_KEY",
      "TTS_OPENAI_MODEL",
      "TTS_OPENAI_VOICE",
      "TTS_OPENAI_USD_PER_MILLION_CHARACTERS",
    ],
    [
      "TTS_GOOGLE_ENABLED",
      "GOOGLE_CLOUD_TTS_API_KEY",
      "TTS_GOOGLE_MODEL",
      "TTS_GOOGLE_VOICE",
      "TTS_GOOGLE_USD_PER_MILLION_CHARACTERS",
    ],
    [
      "TTS_ELEVENLABS_ENABLED",
      "ELEVENLABS_API_KEY",
      "TTS_ELEVENLABS_MODEL",
      "TTS_ELEVENLABS_VOICE_ID",
      "TTS_ELEVENLABS_USD_PER_MILLION_CHARACTERS",
    ],
  ];
  let enabledTtsProviders = 0;
  for (const [enabledKey, secret, model, voice, price] of ttsProviders) {
    if (!enabled(enabledKey)) continue;
    enabledTtsProviders += 1;
    requireSecret(secret);
    requireValue(model);
    requireValue(voice);
    requirePositiveNumber(price);
  }
  if (enabledTtsProviders === 0) {
    errors.push(
      "Operational article audio requires at least one explicitly enabled TTS provider.",
    );
  }
  const providerFlags = {
    OPENAI: "TTS_OPENAI_ENABLED",
    OPENAI_TTS: "TTS_OPENAI_ENABLED",
    GOOGLE: "TTS_GOOGLE_ENABLED",
    GOOGLE_CLOUD_TTS: "TTS_GOOGLE_ENABLED",
    ELEVENLABS: "TTS_ELEVENLABS_ENABLED",
  };
  const configuredRoute = (env.TTS_PROVIDER_ORDER ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (
    configuredRoute.some((provider) => !(provider in providerFlags)) ||
    !configuredRoute.some(
      (provider) => env[providerFlags[provider]] === "true",
    )
  ) {
    errors.push(
      "TTS_PROVIDER_ORDER must contain at least one explicitly enabled server TTS provider.",
    );
  }
  const dailyBudget = Number(env.TTS_DAILY_BUDGET_USD);
  const perArticleBudget = Number(env.TTS_PER_ARTICLE_BUDGET_USD);
  if (
    Number.isFinite(dailyBudget) &&
    Number.isFinite(perArticleBudget) &&
    perArticleBudget > dailyBudget
  ) {
    errors.push(
      "TTS_PER_ARTICLE_BUDGET_USD cannot exceed TTS_DAILY_BUDGET_USD.",
    );
  }
}
if (enabled("FEATURE_SOURCE_ACQUISITION")) {
  requireHttpsUrl("SOURCE_FETCH_PROXY_URL");
  requireSecret("SOURCE_FETCH_PROXY_TOKEN");
  requireValue("AI_ALLOWED_FETCH_HOSTS");
}
if (enabled("FEATURE_TREND_CONNECTORS")) {
  requireValue("WIKIMEDIA_USER_AGENT");
  requireValue("RSS_FEED_ALLOWLIST");
}
if (enabled("CONNECTORS_ENABLED") && env.CONNECTORS_GLOBAL_KILL === "false") {
  if (
    !enabled("TREND_GDELT_ENABLED") &&
    !enabled("TREND_RSS_ENABLED") &&
    !enabled("SEARCH_CONNECTOR_ENABLED")
  ) {
    errors.push("Operational connectors require at least one connector enable flag.");
  }
  if (enabled("TREND_RSS_ENABLED")) requireValue("RSS_FEED_ALLOWLIST");
  if (enabled("SEARCH_CONNECTOR_ENABLED")) {
    requireHttpsUrl("SEARCH_ENDPOINT");
    requireSecret("SEARCH_API_KEY");
  }
}
if (enabled("FEATURE_EMAIL_DELIVERY")) {
  requireValue("EMAIL_PROVIDER");
  requireSecret("EMAIL_API_KEY");
  requireValue("EMAIL_FROM_ADDRESS");
}
if (enabled("FEATURE_MONITORING")) {
  if (!env.SENTRY_DSN?.trim() && !env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()) {
    errors.push(
      "FEATURE_MONITORING requires SENTRY_DSN or OTEL_EXPORTER_OTLP_ENDPOINT.",
    );
  }
}
if (enabled("FEATURE_SCHEDULED_INGESTION")) {
  requireSecret("CRON_SECRET");
  requireValue("TREND_REFRESH_CRON");
  requireValue("RSS_INGESTION_CRON");
}
if (enabled("FEATURE_BACKUPS")) {
  requireValue("BACKUP_PROVIDER");
  requireValue("BACKUP_BUCKET");
  requireSecret("BACKUP_ENCRYPTION_KEY");
}

if (errors.length > 0) {
  console.error("Environment validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Environment validation passed for ${environment}.`);

function enabled(key) {
  return env[key] === "true";
}

function requireValue(key) {
  if (!env[key]?.trim()) errors.push(`${key} is required by the current configuration.`);
}

function requireSecret(key) {
  const value = env[key]?.trim();
  if (!value || value.length < 32) {
    errors.push(`${key} must contain at least 32 characters.`);
  }
}

function requireHttpsUrl(key) {
  try {
    const value = new URL(env[key] ?? "");
    if (value.protocol !== "https:" || value.username || value.password) {
      throw new Error("unsafe");
    }
  } catch {
    errors.push(`${key} must be an absolute HTTPS URL.`);
  }
}

function requirePositiveNumber(key) {
  const value = Number(env[key]);
  if (!Number.isFinite(value) || value <= 0) {
    errors.push(`${key} must be a positive number.`);
  }
}

function requireNonNegativeNumber(key) {
  const value = Number(env[key]);
  if (!env[key]?.trim() || !Number.isFinite(value) || value < 0) {
    errors.push(`${key} must be a non-negative number.`);
  }
}

function requireSafeLocalAiUrl(key) {
  try {
    const value = new URL(env[key] ?? "");
    const loopback =
      value.hostname === "localhost" ||
      value.hostname === "127.0.0.1" ||
      value.hostname === "[::1]";
    if (
      value.username ||
      value.password ||
      (value.protocol !== "https:" &&
        !(value.protocol === "http:" && loopback))
    ) {
      throw new Error("unsafe");
    }
  } catch {
    errors.push(
      `${key} must use HTTPS or an HTTP loopback address without embedded credentials.`,
    );
  }
}

function requirePositiveInteger(key, allowZero = false) {
  const value = Number(env[key]);
  const valid = Number.isInteger(value) && (allowZero ? value >= 0 : value > 0);
  if (!valid) errors.push(`${key} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
}

function requireBoundedInteger(key, minimum, maximum) {
  const value = Number(env[key]);
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    errors.push(
      `${key} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
}
