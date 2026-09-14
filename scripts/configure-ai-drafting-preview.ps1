param(
  [string]$Environment = "preview"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$outputDir = Join-Path $projectRoot "outputs"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$configPath = Join-Path $outputDir "ai-drafting-$Environment.json"

$config = @{
  AI_QUICK_BRIEF_MIN_WORDS = "400"
  AI_QUICK_BRIEF_TARGET_WORDS = "550"
  AI_QUICK_BRIEF_MAX_WORDS = "700"

  AI_STANDARD_NEWS_MIN_WORDS = "900"
  AI_STANDARD_NEWS_TARGET_WORDS = "1200"
  AI_STANDARD_NEWS_MAX_WORDS = "1500"

  AI_DEEP_EXPLAINER_MIN_WORDS = "1800"
  AI_DEEP_EXPLAINER_TARGET_WORDS = "2400"
  AI_DEEP_EXPLAINER_MAX_WORDS = "3000"

  AI_MIN_PRIMARY_SOURCES = "1"
  AI_MIN_INDEPENDENT_SOURCES = "2"
  AI_MAX_RESEARCH_SOURCES = "8"

  AI_REQUIRE_FACT_REVIEW = "true"
  AI_REQUIRE_HUMAN_APPROVAL = "true"

  AI_MAX_CONTEXT_TOKENS = "400000"
  AI_MAX_OUTPUT_TOKENS = "20000"
  AI_PER_STORY_BUDGET_USD = "10.00"
  AI_PER_TASK_BUDGET_USD = "2.00"
  AI_PROVIDER_TIMEOUT_MS = "240000"
  AI_PROVIDER_RETRY_ATTEMPTS = "1"

  AI_RESEARCH_CHAIN = "anthropic"
  AI_FACT_REVIEW_CHAIN = "anthropic:claude-haiku-4-5-20251001"
  AI_COPY_EDIT_CHAIN = "anthropic"

  AI_ENABLED = "true"
  AI_GLOBAL_KILL = "true"
  AI_ANTHROPIC_ENABLED = "true"
  AI_ANTHROPIC_WEB_SEARCH_ENABLED = "true"
  AI_ANTHROPIC_WEB_SEARCH_MAX_USES = "2"

  FEATURE_AUTO_PUBLISH = "false"
  AUTO_PUBLISH_READINESS_APPROVED = "false"
  AUTO_PUBLISH_MODE = "approved_only"
  AUTO_PUBLISH_DAILY_LIMIT = "2"

  ENABLE_SEARCH_INDEXING = "false"
  ROBOTS_ALLOW_INDEXING = "false"
  FEATURE_ADSENSE = "false"
  AD_GLOBAL_KILL = "true"
  FEATURE_POLITICAL_ADS = "false"
}

try {
  $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding utf8
  & ".\node_modules\.bin\wrangler.cmd" secret bulk $configPath --env $Environment
  if ($LASTEXITCODE -ne 0) {
    throw "Wrangler secret bulk failed."
  }
  Write-Host "AI drafting configuration uploaded to $Environment." -ForegroundColor Green
  Write-Host "ANTHROPIC_API_KEY and AI_ANTHROPIC_MODEL are not changed by this script." -ForegroundColor Yellow
}
finally {
  Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
}
