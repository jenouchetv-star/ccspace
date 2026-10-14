# One-shot deploy for the admin-reset-mfa Edge Function.
#
# DO NOT RUN until the owner has approved deployment (see the rollout order
# in README.md, "Admin two-factor authentication").
#
# SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are reserved
# names that Supabase auto-injects into every deployed Edge Function, so
# this script only needs your personal access token, to link and deploy.
# The notice email uses the same RESEND_API_KEY / RESEND_FROM secrets that
# send-newsletter already uses; without them the reset still works.
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-admin-reset-mfa.ps1
#
# Nothing is written to disk by this script - closing the terminal clears
# the token, and it is safe to keep this file in the repo as-is.

# Deploys to the LIVE project unless you pass -ProjectRef <ref> (use that to
# deploy to a throwaway project for testing, e.g.
#   .\supabase\deploy-admin-reset-mfa.ps1 -ProjectRef abcdefghijklmnop ).
param([string]$ProjectRef = "wdctkfhwygwwulipwnys")

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "SUPABASE_ACCESS_TOKEN is not set. Run:" -ForegroundColor Red
  Write-Host '  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."' -ForegroundColor Yellow
  exit 1
}

Write-Host "Linking project..." -ForegroundColor Cyan
Write-Host "Target project: $ProjectRef" -ForegroundColor Yellow
npx supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Deploying admin-reset-mfa..." -ForegroundColor Cyan
npx supabase functions deploy admin-reset-mfa
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done." -ForegroundColor Green
}
