param(
  [ValidateSet("preview", "production", "all")]
  [string]$Environment = "all"
)

$ErrorActionPreference = "Stop"
Write-Host "Northline Cloudflare provisioning helper" -ForegroundColor Cyan
Write-Host "This script creates named resources. It does not insert secrets or deploy code." -ForegroundColor Yellow

npx wrangler whoami

if ($Environment -in @("preview", "all")) {
  npx wrangler d1 create northline-preview
  npx wrangler r2 bucket create northline-media-preview
  npx wrangler r2 bucket create northline-media-quarantine-preview
  npx wrangler r2 bucket create northline-article-audio-preview
  npx wrangler queues create northline-editorial-preview
  npx wrangler queues create northline-editorial-preview-dlq
  npx wrangler queues create northline-media-jobs-preview
  npx wrangler queues create northline-media-jobs-preview-dlq
  npx wrangler queues create northline-ad-events-preview
  npx wrangler queues create northline-ad-events-preview-dlq
}

if ($Environment -in @("production", "all")) {
  npx wrangler d1 create northline-production
  npx wrangler r2 bucket create northline-media
  npx wrangler r2 bucket create northline-media-quarantine
  npx wrangler r2 bucket create northline-article-audio
  npx wrangler r2 bucket create northline-backups
  npx wrangler queues create northline-editorial
  npx wrangler queues create northline-editorial-dlq
  npx wrangler queues create northline-media-jobs
  npx wrangler queues create northline-media-jobs-dlq
  npx wrangler queues create northline-ad-events
  npx wrangler queues create northline-ad-events-dlq
}

Write-Host "Copy the returned D1 IDs into wrangler.jsonc, then run the migration commands." -ForegroundColor Green
