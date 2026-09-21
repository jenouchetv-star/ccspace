# One-shot deploy for the generate-sitemap Edge Function (rebuilds
# sitemap.xml from live Supabase content and publishes it to the public
# "uploads" Storage bucket for the admin portal's "Regenerate sitemap"
# button - see Admin -> Settings -> Data controls).
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-generate-sitemap.ps1
#
# No new secrets to set - this function reuses SUPABASE_URL,
# SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY, which Supabase already
# injects into every Edge Function automatically.
#
# Nothing is written to disk by this script - closing the terminal clears
# the token, and it is safe to keep this file in the repo as-is.

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "SUPABASE_ACCESS_TOKEN is not set. Run:" -ForegroundColor Red
  Write-Host '  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."' -ForegroundColor Yellow
  exit 1
}

Write-Host "Linking project..." -ForegroundColor Cyan
npx supabase link --project-ref wdctkfhwygwwulipwnys
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Deploying generate-sitemap..." -ForegroundColor Cyan
npx supabase functions deploy generate-sitemap
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. The 'uploads' Storage bucket must already be public (it is - media assets already rely on this) for the generated sitemap.xml to be publicly reachable at its Storage URL." -ForegroundColor Green
}
