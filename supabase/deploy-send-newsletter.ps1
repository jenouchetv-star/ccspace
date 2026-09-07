# One-shot deploy for the send-newsletter Edge Function (broadcasts an
# admin-written update to every active subscriber via Resend).
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-send-newsletter.ps1
#
# This only deploys the function's code. It reuses the same RESEND_API_KEY
# and RESEND_FROM secrets already set for the notify function (see
# deploy-notify.ps1) - nothing new to configure there. It does need the
# unsubscribe_newsletter() RPC from migration.sql (search that file for
# "unsubscribe_newsletter") to exist first, or every email's unsubscribe
# link will fail - run that block in the SQL Editor before sending your
# first real newsletter.
#
# One secret this needs that notify doesn't: SITE_URL, the site's own
# public address, used to build each recipient's unsubscribe link if the
# request has no browser Origin header to fall back on:
#
#   npx supabase secrets set SITE_URL=https://www.chikescreativespace.com
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

Write-Host "Deploying send-newsletter..." -ForegroundColor Cyan
npx supabase functions deploy send-newsletter
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. Make sure RESEND_API_KEY and RESEND_FROM are set (see deploy-notify.ps1) and the unsubscribe_newsletter() SQL block has been run." -ForegroundColor Green
}
