# One-shot deploy for the report-client-error Edge Function (records a
# render crash - message, stack, and route PATTERN only, never a resolved
# path/id/query - to the existing admin "issues" worklist, wired to the
# try/catch already inside render() in index.html).
#
# Before running: set your Supabase personal access token for this
# terminal session (get one at https://supabase.com/dashboard/account/tokens):
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Then run:
#
#   .\supabase\deploy-report-client-error.ps1
#
# No new secrets to set - this function reuses SUPABASE_URL and
# SUPABASE_SERVICE_ROLE_KEY, which Supabase already injects into every Edge
# Function automatically.
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

Write-Host "Deploying report-client-error..." -ForegroundColor Cyan
npx supabase functions deploy report-client-error
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. Render crashes will now show up in Admin -> Issues, tagged 'Render error: ...'." -ForegroundColor Green
}
