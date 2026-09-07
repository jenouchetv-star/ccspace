# One-shot deploy for the notify Edge Function (Resend emails for new
# contact/business tickets and new newsletter subscribers).
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-notify.ps1
#
# This only deploys the function's code. It still needs its secrets set
# once (Studio -> Edge Functions -> notify -> Secrets, or the CLI):
#
#   npx supabase secrets set RESEND_API_KEY=re_...
#   npx supabase secrets set RESEND_FROM="Chike's Creative Space <hello@chikescreativespace.com>"
#   npx supabase secrets set ADMIN_NOTIFY_EMAIL=info@chikescreativespace.com
#   npx supabase secrets set WEBHOOK_SECRET=<a long random string you make up>
#
# WEBHOOK_SECRET must match the secret baked into the trigger SQL in
# migration.sql (search for "notify Edge Function triggers") - generate one
# random value and use it in both places.
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

Write-Host "Deploying notify..." -ForegroundColor Cyan
npx supabase functions deploy notify
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. Set the four secrets above (if you haven't already), then run the trigger SQL block in migration.sql." -ForegroundColor Green
}
