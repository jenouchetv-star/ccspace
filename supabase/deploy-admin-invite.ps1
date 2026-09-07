# One-shot deploy for the admin-invite Edge Function.
#
# SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are reserved
# names that Supabase auto-injects into every deployed Edge Function - the
# CLI actively refuses to let you set them manually (confirmed: "Env name
# cannot start with SUPABASE_, skipping"). So this script only needs your
# personal access token, to link and deploy; no other secret to handle.
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-admin-invite.ps1
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

Write-Host "Deploying admin-invite..." -ForegroundColor Cyan
npx supabase functions deploy admin-invite
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. Paste this output back so it can be verified." -ForegroundColor Green
}
