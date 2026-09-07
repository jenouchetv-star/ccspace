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
# random value and use it in both places. Supabase secrets are project-wide,
# so if another function in this project already has WEBHOOK_SECRET set
# (e.g. send-scheduled-newsletters), this function already has it too -
# reuse that value in the trigger SQL rather than setting a second one.
#
# Deploys with --no-verify-jwt: pg_net's http_post() (fired from inside a
# Postgres trigger, with no browser/session involved) can never attach a
# Supabase session JWT, so leaving JWT verification on makes Supabase's own
# platform gateway 401 every trigger-fired call before this function's own
# x-webhook-secret check ever runs - confirmed broken this exact way for
# send-scheduled-newsletters until that flag was added there; don't drop it
# here either.
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
npx supabase functions deploy notify --no-verify-jwt
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. Set the four secrets above (if you haven't already), then run the trigger SQL block in migration.sql." -ForegroundColor Green
}
