param(
  [ValidateSet("preview", "production")]
  [string]$Environment = "preview",
  [string]$ProjectPath = (Split-Path $PSScriptRoot -Parent),
  [string]$AnthropicModel = "claude-haiku-4-5-20251001",
  [string]$GoogleModel = "gemini-2.5-flash",
  [string]$ElevenLabsModel = "eleven_multilingual_v2",
  [int]$DraftsPerDay = 25,
  [int]$PublishesPerDay = 25
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectPath

$wrangler = Join-Path $ProjectPath "node_modules\.bin\wrangler.cmd"
if (-not (Test-Path -LiteralPath $wrangler)) {
  throw "Wrangler was not found. Run npm ci first."
}

function Read-OptionalSecureValue([string]$Label) {
  $secure = Read-Host "$Label (press Enter to preserve the existing secret)" -AsSecureString
  $pointer = [IntPtr]::Zero
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    if ($pointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
  }
}

function Read-OptionalValue([string]$Label, [string]$Default = "") {
  $suffix = if ($Default) { " [$Default]" } else { "" }
  $value = Read-Host "$Label$suffix"
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value.Trim()
}

if ($DraftsPerDay -lt 1 -or $DraftsPerDay -gt 100) {
  throw "DraftsPerDay must be from 1 through 100."
}
if ($PublishesPerDay -lt 1 -or $PublishesPerDay -gt 100) {
  throw "PublishesPerDay must be from 1 through 100."
}

Write-Host "" 
Write-Host "Northline final autonomous newsroom configuration" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "Secrets are not printed or written to the project." -ForegroundColor Yellow

$anthropicKey = Read-OptionalSecureValue "ANTHROPIC_API_KEY"
$googleKey = Read-OptionalSecureValue "GOOGLE_AI_API_KEY"
$elevenLabsKey = Read-OptionalSecureValue "ELEVENLABS_API_KEY"
$voiceId = Read-OptionalValue "ElevenLabs voice ID"

$enableGdeltAnswer = Read-OptionalValue "Enable GDELT discovery? Type YES only if the Cloudflare egress diagnostic succeeds" "NO"
$enableGdelt = $enableGdeltAnswer -eq "YES"

$enableEmailAnswer = Read-OptionalValue "Enable Resend email delivery now? Type YES only when the sending domain is verified" "NO"
$enableEmail = $enableEmailAnswer -eq "YES"
$emailApiKey = ""
$emailFrom = ""
if ($enableEmail) {
  $emailApiKey = Read-OptionalSecureValue "EMAIL_API_KEY (Resend)"
  $emailFrom = Read-OptionalValue "Verified EMAIL_FROM_ADDRESS"
  if (-not $emailApiKey -or $emailFrom -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    throw "A Resend API key and verified sender address are required."
  }
}

$enableMonitoringAnswer = Read-OptionalValue "Enable Sentry monitoring now? Type YES only when you have a Worker-compatible DSN" "NO"
$enableMonitoring = $enableMonitoringAnswer -eq "YES"
$sentryDsn = ""
if ($enableMonitoring) {
  $sentryDsn = Read-OptionalSecureValue "SENTRY_DSN"
  if (-not $sentryDsn -or $sentryDsn -notmatch '^https://') {
    throw "A valid HTTPS Sentry DSN is required."
  }
}

$enableAdsenseAnswer = Read-OptionalValue "Enable AdSense now? Type YES only after Google approved the site" "NO"
$enableAdsense = $enableAdsenseAnswer -eq "YES"
$adsenseConsentReady = $false
$adsenseClient = ""
$adsenseTop = ""
$adsenseMid = ""
$adsenseEnd = ""
if ($enableAdsense) {
  $adsenseClient = Read-OptionalValue "AdSense client ID (ca-pub-...)"
  $adsenseTop = Read-OptionalValue "Article top ad slot ID"
  $adsenseMid = Read-OptionalValue "Article middle ad slot ID"
  $adsenseEnd = Read-OptionalValue "Article end ad slot ID"
  if ($adsenseClient -notmatch '^ca-pub-\d{10,30}$') {
    throw "The AdSense client ID is invalid."
  }
  $cmpAnswer = Read-OptionalValue "Has a Google-certified CMP/Privacy & messaging flow been published? Type YES" "NO"
  $adsenseConsentReady = $cmpAnswer -eq "YES"
  if (-not $adsenseConsentReady) {
    throw "AdSense stays disabled until a certified CMP or Google Privacy & messaging flow is published."
  }
}

$enableIndexingAnswer = Read-OptionalValue "Enable public Google indexing now? Type YES only on the production domain" "NO"
$enableIndexing = $enableIndexingAnswer -eq "YES"
$googleVerification = ""
if ($enableIndexing) {
  $googleVerification = Read-OptionalValue "Google Search Console HTML verification token (optional for a DNS-verified Domain property)"
  if ([string]::IsNullOrWhiteSpace($googleVerification)) {
    Write-Host "Using the existing DNS-verified Search Console Domain property." -ForegroundColor Green
  }
}

$values = [ordered]@{
  NODE_ENV = "production"
  APP_ENV = $(if ($Environment -eq "production") { "production" } else { "preview" })
  DEMO_CONTENT_MODE = "false"
  NEXT_PUBLIC_SITE_URL = $(if ($Environment -eq "production") { "https://usnorthline.com" } else { "https://staging.usnorthline.com" })

  AI_ENABLED = "true"
  AI_GLOBAL_KILL = "false"
  AI_PROVIDER_ORDER = "google,anthropic,local"
  AI_PROVIDER_TIMEOUT_MS = "300000"
  AI_PROVIDER_RETRY_ATTEMPTS = "1"
  AI_MAX_RETRIES = "1"
  AI_MAX_CONCURRENT_JOBS = "1"

  AI_ANTHROPIC_ENABLED = "true"
  AI_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
  AI_ANTHROPIC_TIER = "paid"
  AI_ANTHROPIC_CAPABILITIES = "fact_review"
  AI_ANTHROPIC_INPUT_USD_PER_MILLION_TOKENS = "1"
  AI_ANTHROPIC_OUTPUT_USD_PER_MILLION_TOKENS = "5"
  AI_ANTHROPIC_WEB_SEARCH_ENABLED = "true"
  AI_ANTHROPIC_WEB_SEARCH_MAX_USES = "1"

  AI_GOOGLE_ENABLED = "true"
  AI_GOOGLE_MODEL = "gemini-2.5-flash"
  AI_GOOGLE_TIER = "free"
  AI_GOOGLE_CAPABILITIES = "classify,summarize,extract,research_synthesis,outline,draft,fact_review,copy_review,seo_review"
  AI_GOOGLE_INPUT_USD_PER_MILLION_TOKENS = "1.5"
  AI_GOOGLE_OUTPUT_USD_PER_MILLION_TOKENS = "9"
  AI_GOOGLE_SEARCH_GROUNDING_ENABLED = "true"

  AI_RESEARCH_CHAIN = "google:gemini-2.5-flash"
  AI_OUTLINE_CHAIN = "google:gemini-2.5-flash-lite"
  AI_DRAFTING_CHAIN = "google:gemini-2.5-flash"
  AI_HEADLINE_CHAIN = "google:gemini-2.5-flash-lite"
  AI_SUMMARY_CHAIN = "google:gemini-2.5-flash-lite"
  AI_FACT_REVIEW_CHAIN = "anthropic:claude-haiku-4-5-20251001"
  AI_COPY_EDIT_CHAIN = "google:gemini-2.5-flash-lite"
  AI_SEO_CHAIN = "google:gemini-2.5-flash-lite"
  AI_CLASSIFICATION_CHAIN = "google:gemini-2.5-flash-lite"
  AI_EXTRACTION_CHAIN = "google:gemini-2.5-flash-lite"

  AI_MAX_CONTEXT_TOKENS = "90000"
  AI_MAX_OUTPUT_TOKENS = "8000"
  AI_PER_STORY_BUDGET_USD = "0.75"
  AI_PER_TASK_BUDGET_USD = "0.15"
  AI_DAILY_BUDGET_USD = "3.00"
  AI_MONTHLY_BUDGET_USD = "50.00"

  AI_QUICK_BRIEF_MIN_WORDS = "650"
  AI_QUICK_BRIEF_TARGET_WORDS = "900"
  AI_QUICK_BRIEF_MAX_WORDS = "1200"
  AI_STANDARD_NEWS_MIN_WORDS = "1200"
  AI_STANDARD_NEWS_TARGET_WORDS = "1600"
  AI_STANDARD_NEWS_MAX_WORDS = "2200"
  AI_DEEP_EXPLAINER_MIN_WORDS = "2200"
  AI_DEEP_EXPLAINER_TARGET_WORDS = "3000"
  AI_DEEP_EXPLAINER_MAX_WORDS = "4000"

  FEATURE_DURABLE_JOBS = "true"
  FEATURE_SCHEDULED_INGESTION = "true"
  FEATURE_TREND_CONNECTORS = "true"
  CONNECTORS_ENABLED = "true"
  CONNECTORS_GLOBAL_KILL = "false"
  TREND_GOOGLE_ENABLED = "true"
  TREND_GDELT_ENABLED = $(if ($enableGdelt) { "true" } else { "false" })

  FEATURE_AUTONOMOUS_NEWSROOM = "true"
  AUTONOMOUS_SYSTEM_APPROVAL = "true"
  AUTONOMOUS_DRAFT_DAILY_LIMIT = "$DraftsPerDay"
  AUTONOMOUS_DRAFT_BATCH_SIZE = "1"
  AUTONOMOUS_MAX_ATTEMPTS = "1"
  AUTONOMOUS_MIN_TREND_SCORE = "55"
  AUTONOMOUS_PROCESS_ALL_ACTIVE_SIGNALS = "true"
  AUTONOMOUS_MIN_QUALITY_SCORE = "85"
  AUTONOMOUS_DAILY_COST_LIMIT_USD = "2.50"
  AUTONOMOUS_ALLOW_QUICK_BRIEFS = "false"
  AUTONOMOUS_FORCE_LONGFORM = "false"

  FEATURE_AUTO_PUBLISH = "true"
  AUTO_PUBLISH_READINESS_APPROVED = "true"
  AUTO_PUBLISH_MODE = "approved_only"
  AUTO_PUBLISH_DAILY_LIMIT = "$PublishesPerDay"
  AUTO_PUBLISH_ALLOWED_CATEGORIES = "US_NEWS,TECHNOLOGY,BUSINESS,ENTERTAINMENT,SPORTS,GAMING,SCIENCE,INTERNET_TRENDS,WEATHER"
  AUTO_PUBLISH_ALLOWED_FORMATS = "QUICK_BRIEF,STANDARD_NEWS,DEEP_EXPLAINER,WHY_TRENDING,SOURCE_COMPARISON"

  FEATURE_ARTICLE_AUDIO = "true"
  ARTICLE_AUDIO_GLOBAL_KILL = "false"
  ARTICLE_AUDIO_PLAYBACK_ENABLED = "true"
  BROWSER_SPEECH_FALLBACK_ENABLED = "true"
  FEATURE_OBJECT_STORAGE = "true"
  ARTICLE_AUDIO_BUCKET = $(if ($Environment -eq "preview") { "northline-article-audio-preview" } else { "northline-article-audio" })
  ARTICLE_AUDIO_STORAGE_PREFIX = "article-audio/v2"
  ARTICLE_AUDIO_DOWNLOAD_ALLOWED = "false"
  ARTICLE_AUDIO_BACKFILL_BATCH_SIZE = "1"
  ARTICLE_AUDIO_DAILY_ARTICLE_LIMIT = "1"
  TTS_PROVIDER_ORDER = "ELEVENLABS"
  TTS_ELEVENLABS_ENABLED = "true"
  TTS_ELEVENLABS_MODEL = "eleven_flash_v2_5"
  TTS_ELEVENLABS_VOICE_ID = $voiceId
  TTS_ELEVENLABS_USD_PER_MILLION_CHARACTERS = "50"
  TTS_OUTPUT_FORMAT = "MP3"
  TTS_CHUNK_MAX_CHARACTERS = "3800"
  TTS_DAILY_BUDGET_USD = "0.20"
  TTS_PER_ARTICLE_BUDGET_USD = "0.20"
  TTS_MAX_ARTICLE_CHARACTERS = "4000"
  TTS_REGENERATION_COOLDOWN = "86400"
  TTS_NARRATION_POLICY_VERSION = "v13-natural-longform"

  FEATURE_INTERNAL_LINKS = "true"
  FEATURE_MONITORING = $(if ($enableMonitoring) { "true" } else { "false" })
  SENTRY_DSN = $sentryDsn
  FEATURE_EMAIL_DELIVERY = $(if ($enableEmail) { "true" } else { "false" })
  EMAIL_PROVIDER = $(if ($enableEmail) { "resend" } else { "" })
  EMAIL_FROM_ADDRESS = $emailFrom

  FEATURE_ADSENSE = $(if ($enableAdsense) { "true" } else { "false" })
  AD_GLOBAL_KILL = $(if ($enableAdsense) { "false" } else { "true" })
  ADSENSE_CONSENT_READY = $(if ($adsenseConsentReady) { "true" } else { "false" })
  ADSENSE_CLIENT_ID = $adsenseClient
  ADSENSE_ARTICLE_TOP_SLOT = $adsenseTop
  ADSENSE_ARTICLE_MID_SLOT = $adsenseMid
  ADSENSE_ARTICLE_END_SLOT = $adsenseEnd
  FEATURE_POLITICAL_ADS = "false"

  ENABLE_SEARCH_INDEXING = $(if ($enableIndexing) { "true" } else { "false" })
  ROBOTS_ALLOW_INDEXING = $(if ($enableIndexing) { "true" } else { "false" })
  GOOGLE_SEARCH_LAUNCH_APPROVED = $(if ($enableIndexing) { "true" } else { "false" })
  GOOGLE_SITE_VERIFICATION = $googleVerification
  GOOGLE_SEARCH_VERIFICATION_METHOD = $(if ($googleVerification) { "html" } else { "dns" })
  SEO_MINIMUM_REAL_STORIES = "20"
}

if ($anthropicKey) { $values.ANTHROPIC_API_KEY = $anthropicKey }
if ($googleKey) { $values.GOOGLE_AI_API_KEY = $googleKey }
if ($elevenLabsKey) { $values.ELEVENLABS_API_KEY = $elevenLabsKey }
if ($emailApiKey) { $values.EMAIL_API_KEY = $emailApiKey }

if (-not $voiceId) {
  throw "An ElevenLabs voice ID is required for natural narration."
}
if (-not $googleKey) {
  Write-Warning "No Google key was supplied. This succeeds only when GOOGLE_AI_API_KEY already exists in Cloudflare."
}
if (-not $elevenLabsKey) {
  Write-Warning "No ElevenLabs key was supplied. This succeeds only when ELEVENLABS_API_KEY already exists in Cloudflare."
}

$entries = @($values.GetEnumerator())
$batchSize = 90
$tempFiles = @()
try {
  for ($offset = 0; $offset -lt $entries.Count; $offset += $batchSize) {
    $batch = [ordered]@{}
    $last = [Math]::Min($offset + $batchSize - 1, $entries.Count - 1)
    for ($index = $offset; $index -le $last; $index++) {
      $entry = $entries[$index]
      $batch[$entry.Key] = [string]$entry.Value
    }
    $batchNumber = [int]($offset / $batchSize) + 1
    $batchCount = [int][Math]::Ceiling($entries.Count / [double]$batchSize)
    $temp = Join-Path $env:TEMP "northline-final-runtime-$Environment-$batchNumber-$([guid]::NewGuid().ToString('N')).json"
    $tempFiles += $temp
    $batch | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $temp -Encoding utf8
    Write-Host "Uploading runtime batch $batchNumber/$batchCount ($($batch.Count) values)..." -ForegroundColor Cyan
    & $wrangler secret bulk $temp --env $Environment --cwd $ProjectPath
    if ($LASTEXITCODE -ne 0) { throw "Cloudflare runtime configuration failed in batch $batchNumber/$batchCount." }
  }
}
finally {
  foreach ($tempFile in $tempFiles) {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
  Remove-Variable anthropicKey, googleKey, elevenLabsKey, emailApiKey, sentryDsn -ErrorAction SilentlyContinue
}

Write-Host "" 
Write-Host "Runtime configuration uploaded successfully." -ForegroundColor Green
Write-Host "Apply migrations and deploy:" -ForegroundColor Cyan
Write-Host "  npm run db:migrate:$Environment"
Write-Host "  npm run deploy:$Environment"
Write-Host "Autonomous status endpoint:" -ForegroundColor Cyan
Write-Host "  /api/newsroom/autonomous/status"
Write-Host "AdSense remains disabled unless you explicitly typed YES after approval." -ForegroundColor Yellow
Write-Host "GDELT, email, and Sentry remain disabled unless explicitly configured." -ForegroundColor Yellow
