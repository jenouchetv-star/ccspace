// Decides whether the opt-in 2FA integration tests may run, and against what.
//
// They create and delete users and switch enforcement on and off, so they
// refuse to touch the live project and only read MFA_IT_* variables (never
// the SUPABASE_* ones that point at the live site), so an ambient key can't
// send them to the wrong place.

export const LIVE_PROJECT_REF = "wdctkfhwygwwulipwnys";

export function integrationConfig(env = process.env) {
  if (env.MFA_IT !== "1") return { enabled: false, reason: "MFA_IT is not set to 1" };

  const missing = ["MFA_IT_SUPABASE_URL", "MFA_IT_ANON_KEY", "MFA_IT_SERVICE_ROLE_KEY"].filter((k) => !env[k]);
  if (missing.length) return { enabled: false, reason: "missing " + missing.join(", ") };

  const raw = String(env.MFA_IT_SUPABASE_URL).trim();
  if (raw.toLowerCase().includes(LIVE_PROJECT_REF)) {
    return { enabled: false, refused: true, reason: "refusing to run against the live project (" + LIVE_PROJECT_REF + "); use a throwaway project" };
  }
  const url = raw.replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
    return { enabled: false, reason: "MFA_IT_SUPABASE_URL must look like https://<ref>.supabase.co" };
  }
  return { enabled: true, url, anonKey: env.MFA_IT_ANON_KEY, serviceKey: env.MFA_IT_SERVICE_ROLE_KEY };
}
