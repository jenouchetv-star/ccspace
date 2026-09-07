# One-shot deploy for the send-scheduled-newsletters Edge Function (fires
# a newsletter automatically once its scheduled time arrives, via a
# pg_cron job that checks every minute).
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-send-scheduled-newsletters.ps1
#
# This only deploys the function's code. It reuses the same RESEND_API_KEY,
# RESEND_FROM, and WEBHOOK_SECRET secrets already set for notify/
# send-newsletter (see deploy-notify.ps1) - nothing new to configure there.
# It does need the newsletters table and the pg_cron job from migration.sql
# (search that file for "send-scheduled-newsletters") to exist first, with
# the job's <FUNCTION_URL> and <WEBHOOK_SECRET> placeholders filled in, or
# nothing will ever call this function.
#
# Also needs SITE_URL - a cron-fired request has no browser Origin header
# to build the unsubscribe link's address from, unlike the immediate
# send-newsletter path:
#
#   npx supabase secrets set SITE_URL=https://www.chikescreativespace.com
#
# Deploys with --no-verify-jwt: pg_cron's net.http_post() can never attach
# a Supabase session JWT, so leaving JWT verification on (the default)
# makes Supabase's own platform gateway 401 every single cron-fired call
# before this function's own x-webhook-secret check ever runs. Confirmed
# broken in production this way until this flag was added - don't drop it
# on a future redeploy.
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

Write-Host "Deploying send-scheduled-newsletters..." -ForegroundColor Cyan
npx supabase functions deploy send-scheduled-newsletters --no-verify-jwt
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. Make sure pg_net is enabled and the newsletters table + pg_cron job have been run (see migration.sql) with the real function URL and WEBHOOK_SECRET filled in." -ForegroundColor Green
}
