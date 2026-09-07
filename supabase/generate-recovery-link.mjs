// One-time bootstrap helper: asks Supabase's admin API for a working
// password-recovery link directly, without going through email delivery -
// a way around the default (very low, no-custom-SMTP) email rate limit
// while testing the new auth system.
//
// Nothing sensitive is stored in this file - the service_role key is read
// from an environment variable you set in your own terminal, for this
// session only. The link this prints is just as sensitive as the one an
// email would have contained - open it yourself, don't paste it into chat.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
//   node supabase/generate-recovery-link.mjs jenouchetv@gmail.com

const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set. Run:");
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY = "..."');
  process.exit(1);
}
if (!email) {
  console.error("Usage: node supabase/generate-recovery-link.mjs you@example.com");
  process.exit(1);
}

const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "recovery",
    email,
    options: { redirectTo: "http://localhost:4321/admin/accept-invite" }
  })
});

const data = await res.json();
if (!res.ok) {
  console.error("Failed:", data.error_code || res.status, data.msg || data.error_description || JSON.stringify(data));
  process.exit(1);
}

console.log("\nOpen this link in your browser (it's single-use, don't share it):\n");
console.log(data.action_link);
console.log("");
