param(
  [switch]$SkipBuild,
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Wrangler = Join-Path $ProjectRoot "node_modules\.bin\wrangler.cmd"
$RuntimeFile = Join-Path $ProjectRoot "outputs\northline-preview-safe-launch.json"

if (-not (Test-Path $Wrangler)) {
  throw "Wrangler was not found. Run npm ci first."
}

Push-Location $ProjectRoot
try {
  New-Item -ItemType Directory -Force (Join-Path $ProjectRoot "outputs") | Out-Null

  @'
{
  "NODE_ENV": "production",
  "APP_ENV": "preview",
  "DEMO_CONTENT_MODE": "false",
  "FEATURE_EDITORIAL_WRITES": "true",
  "FEATURE_DURABLE_JOBS": "true",
  "FEATURE_SCHEDULED_INGESTION": "true",
  "FEATURE_TREND_CONNECTORS": "true",
  "CONNECTORS_ENABLED": "true",
  "CONNECTORS_GLOBAL_KILL": "false",
  "TREND_GOOGLE_ENABLED": "true",
  "TREND_GDELT_ENABLED": "true",
  "TREND_RSS_ENABLED": "false",
  "SEARCH_CONNECTOR_ENABLED": "false",
  "FEATURE_SOURCE_ACQUISITION": "false",
  "FEATURE_OBJECT_STORAGE": "true",
  "FEATURE_INTERNAL_LINKS": "true",
  "AI_ENABLED": "true",
  "AI_GLOBAL_KILL": "false",
  "AI_ANTHROPIC_ENABLED": "true",
  "FEATURE_EMAIL_DELIVERY": "true",
  "FEATURE_MONITORING": "true",
  "FEATURE_AUTO_PUBLISH": "false",
  "AUTO_PUBLISH_READINESS_APPROVED": "false",
  "ENABLE_SEARCH_INDEXING": "false",
  "ROBOTS_ALLOW_INDEXING": "false",
  "FEATURE_ADSENSE": "false",
  "AD_GLOBAL_KILL": "true",
  "FEATURE_POLITICAL_ADS": "false"
}
'@ | Set-Content $RuntimeFile -Encoding utf8

  Write-Host "Uploading reviewed Preview feature states..." -ForegroundColor Cyan
  & $Wrangler secret bulk $RuntimeFile --env preview
  if ($LASTEXITCODE -ne 0) { throw "Preview feature-state upload failed." }

  Write-Host "Applying Preview migrations..." -ForegroundColor Cyan
  npm run db:migrate:preview
  if ($LASTEXITCODE -ne 0) { throw "Preview migrations failed." }

  Write-Host "Seeding the 100-source editorial registry..." -ForegroundColor Cyan
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\seed-editorial-sources.ps1 -Environment preview
  if ($LASTEXITCODE -ne 0) { throw "Editorial source seed failed." }

  Write-Host "Running contract, type, lint, and domain tests..." -ForegroundColor Cyan
  npm run test:v12:csrf-sources
  if ($LASTEXITCODE -ne 0) { throw "Editorial CSRF/source contract tests failed." }
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }
  npm run lint
  if ($LASTEXITCODE -ne 0) { throw "Lint failed." }
  npm run test:domain
  if ($LASTEXITCODE -ne 0) { throw "Domain tests failed." }

  if (-not $SkipBuild) {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
  }

  if (-not $SkipDeploy) {
    npm run deploy:preview
    if ($LASTEXITCODE -ne 0) { throw "Preview deployment failed." }
  }

  Write-Host "`nPreview finalization completed." -ForegroundColor Green
  Write-Host "Auto-publish, indexing, AdSense, and political ads remain intentionally gated." -ForegroundColor Yellow
}
finally {
  Remove-Item $RuntimeFile -Force -ErrorAction SilentlyContinue
  Pop-Location
}
