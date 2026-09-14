param(
  [ValidateSet("preview", "production")]
  [string]$Environment = "preview",
  [string]$ProjectPath = (Split-Path $PSScriptRoot -Parent),
  [string]$ProductionD1Id = "",
  [int]$DraftsPerDay = 100,
  [int]$PublishesPerDay = 50,
  [switch]$SkipInstall,
  [switch]$SkipConfiguration,
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectPath

function Invoke-Native([string]$Label, [scriptblock]$Action) {
  Write-Host ""
  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

function Assert-NodeVersion {
  $raw = (& node.exe -p "process.versions.node").Trim()
  if (-not $raw) { throw "Node.js is not installed." }
  $actual = [version]$raw
  $minimum = [version]"22.19.0"
  if ($actual -lt $minimum) {
    throw "Northline requires Node.js 22.19.0 or newer. Installed: $actual"
  }
}

function Configure-ProductionD1 {
  $wranglerPath = Join-Path $ProjectPath "wrangler.jsonc"
  $text = [System.IO.File]::ReadAllText($wranglerPath)
  if ($text -notmatch 'REPLACE_WITH_PRODUCTION_D1_ID') { return }

  $databaseId = $ProductionD1Id.Trim()
  if (-not $databaseId) {
    $databaseId = (Read-Host "Production D1 database UUID").Trim()
  }
  if ($databaseId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') {
    throw "ProductionD1Id must be a valid UUID returned by Wrangler."
  }

  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  Copy-Item -LiteralPath $wranglerPath -Destination "$wranglerPath.before-production-$stamp.bak" -Force
  $text = $text.Replace("REPLACE_WITH_PRODUCTION_D1_ID", $databaseId)
  [System.IO.File]::WriteAllText(
    $wranglerPath,
    $text,
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-Host "Production D1 binding updated." -ForegroundColor Green
}

Assert-NodeVersion

if ($Environment -eq "production") {
  Configure-ProductionD1
}

if (-not $SkipInstall) {
  Invoke-Native "Installing locked dependencies" { npm.cmd ci }
}

Invoke-Native "TypeScript typecheck" { npm.cmd run typecheck }
Invoke-Native "ESLint" { npm.cmd run lint }
Invoke-Native "Autonomous newsroom contract tests" { npm.cmd run test:v13:autonomous }
Invoke-Native "Cost guard tests" { npm.cmd run test:v12:ai-cost-guard }
Invoke-Native "Editorial source and CSRF tests" { npm.cmd run test:v12:csrf-sources }
Invoke-Native "Production newsroom tests" { npm.cmd run test:v12:newsroom-core }
Invoke-Native "Domain test suite" { npm.cmd run test:domain }

Invoke-Native "Applying $Environment D1 migrations" {
  npm.cmd run "db:migrate:$Environment"
}

if (-not $SkipDeploy) {
  Invoke-Native "Deploying $Environment" {
    npm.cmd run "deploy:$Environment"
  }
}

if (-not $SkipConfiguration) {
  $configurationScript = Join-Path $ProjectPath "scripts\configure-final-autonomous-newsroom.ps1"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $configurationScript `
    -Environment $Environment `
    -ProjectPath $ProjectPath `
    -DraftsPerDay $DraftsPerDay `
    -PublishesPerDay $PublishesPerDay
  if ($LASTEXITCODE -ne 0) {
    throw "Runtime configuration failed."
  }
}

Write-Host ""
Write-Host "Northline final launch completed." -ForegroundColor Green
Write-Host "Autonomous drafting: up to $DraftsPerDay signals per UTC day." -ForegroundColor Green
Write-Host "Publication: up to $PublishesPerDay gate-approved stories per UTC day." -ForegroundColor Green
Write-Host "The remaining active-signal backlog continues on later days." -ForegroundColor Green
Write-Host ""
Write-Host "Open these pages:" -ForegroundColor Cyan
Write-Host "  /newsroom/autonomous"
Write-Host "  /newsroom/jobs"
Write-Host "  /newsroom/integrations"
Write-Host "  /api/health/readiness"
Write-Host ""
Write-Host "AdSense is activated only when the site is approved and a certified consent flow is confirmed." -ForegroundColor Yellow
