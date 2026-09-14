param(
  [ValidateSet("local", "preview", "production")]
  [string]$Environment = "preview"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Wrangler = Join-Path $ProjectRoot "node_modules\.bin\wrangler.cmd"
$SeedFile = Join-Path $PSScriptRoot "seed-editorial-sources.sql"

if (-not (Test-Path $Wrangler)) {
  throw "Wrangler was not found. Run npm ci first."
}

if (-not (Test-Path $SeedFile)) {
  throw "The source seed SQL file is missing: $SeedFile"
}

Push-Location $ProjectRoot
try {
  switch ($Environment) {
    "local" {
      & $Wrangler d1 execute northline-development --local --file $SeedFile
      & $Wrangler d1 execute northline-development --local --command "SELECT COUNT(*) AS source_count FROM sources;"
    }
    "preview" {
      & $Wrangler d1 execute northline-preview --remote --env preview --file $SeedFile
      & $Wrangler d1 execute northline-preview --remote --env preview --command "SELECT name,domain,source_type,credibility_tier,is_primary,licensing_status FROM sources ORDER BY credibility_tier ASC,is_primary DESC,name ASC;"
    }
    "production" {
      & $Wrangler d1 execute northline-production --remote --env production --file $SeedFile
      & $Wrangler d1 execute northline-production --remote --env production --command "SELECT name,domain,source_type,credibility_tier,is_primary,licensing_status FROM sources ORDER BY credibility_tier ASC,is_primary DESC,name ASC;"
    }
  }

  if ($LASTEXITCODE -ne 0) {
    throw "The source registry seed failed with exit code $LASTEXITCODE."
  }

  Write-Host "`nEditorial source registry seeded successfully for $Environment." -ForegroundColor Green
}
finally {
  Pop-Location
}
