# One-shot deploy for the get-site-analytics Edge Function (proxies
# Cloudflare's GraphQL Analytics API into the admin dashboard).
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-get-site-analytics.ps1
#
# This only deploys the function's code. It still needs its secrets set
# once (Studio -> Edge Functions -> get-site-analytics -> Secrets, or the
# CLI) - all three are required, none of them are guessable defaults:
#
#   npx supabase secrets set CLOUDFLARE_API_TOKEN=<the token you just created>
#   npx supabase secrets set CLOUDFLARE_ACCOUNT_ID=3a72af55deb8e39b2bcc91e2c082e6d5
#   npx supabase secrets set CLOUDFLARE_SITE_TAG=aa23b757e3104b1f8953cf3195cc9e2b
#
# CLOUDFLARE_API_TOKEN must be an Account API Token scoped to exactly
# Account > Account Analytics > Read on this one account - nothing
# broader. Create it at https://dash.cloudflare.com/profile/api-tokens ->
# Create Token -> Create Custom Token. CLOUDFLARE_SITE_TAG is the same
# value as the token in the beacon snippet's data-cf-beacon attribute
# (see index.html, right before </body>) - it is not a secret, but it
# has to match the site this token can actually read.
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

Write-Host "Deploying get-site-analytics..." -ForegroundColor Cyan
npx supabase functions deploy get-site-analytics
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. Set the three secrets above (if you haven't already) for this to actually return data." -ForegroundColor Green
}
