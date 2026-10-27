# One-shot deploy for the Newsletter Portal Edge Functions.
#
# DO NOT RUN until the owner has approved deployment (see README.md,
# "Newsletter portal"), and only after supabase/newsletter-portal.sql has been
# run in the SQL Editor - the functions need its tables.
#
# Deploys three functions:
#   portal                       the gatekeeper (verification links, sessions, the members-only content)
#   send-newsletter              now puts each subscriber's private archive key into portal links
#   send-scheduled-newsletters   same, for newsletters sent on a schedule
#
# They share supabase/functions/_shared/portal.ts, which the Supabase CLI
# bundles into each one automatically.
#
# SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by
# Supabase. RESEND_API_KEY, RESEND_FROM and SITE_URL are already set for the
# newsletter functions. The one NEW secret is PORTAL_LINK_SECRET: a long random
# string that signs the private keys in newsletters. Set it once, before
# deploying (the same value serves all three functions, since secrets are per project):
#
#   npx supabase secrets set PORTAL_LINK_SECRET=<48+ random characters>
#
# One way to make one: [Convert]::ToBase64String((1..36 | % { Get-Random -Maximum 256 }))
#
# Changing it later retires every private key already emailed (the visitor just
# gets the normal "Join our mailing list" screen). Keep it out of git.
#
# Before running: set your Supabase personal access token for this terminal
# session (https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-portal.ps1
#
# Deploys to the LIVE project unless you pass -ProjectRef <ref>.
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

foreach ($fn in @("portal", "send-newsletter", "send-scheduled-newsletters")) {
  Write-Host "Deploying $fn..." -ForegroundColor Cyan
  npx supabase functions deploy $fn
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "Done. Check that PORTAL_LINK_SECRET is set (npx supabase secrets list) before sending a newsletter." -ForegroundColor Green
