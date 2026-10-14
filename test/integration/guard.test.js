// The integration tests switch enforcement on and off and create and delete
// users, so the one thing they must never do is run against the live site.
// This pins that guard.
import { describe, it, expect } from "vitest";
import { integrationConfig, LIVE_PROJECT_REF } from "./guard.js";

const good = {
  MFA_IT: "1",
  MFA_IT_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  MFA_IT_ANON_KEY: "anon",
  MFA_IT_SERVICE_ROLE_KEY: "service",
};

describe("integrationConfig", () => {
  it("is off unless MFA_IT=1", () => {
    expect(integrationConfig({}).enabled).toBe(false);
    expect(integrationConfig({ ...good, MFA_IT: "0" }).enabled).toBe(false);
    expect(integrationConfig({ ...good, MFA_IT: "true" }).enabled).toBe(false);
  });
  it("names what is missing", () => {
    const r = integrationConfig({ MFA_IT: "1", MFA_IT_SUPABASE_URL: good.MFA_IT_SUPABASE_URL });
    expect(r.enabled).toBe(false);
    expect(r.reason).toMatch(/MFA_IT_ANON_KEY/);
    expect(r.reason).toMatch(/MFA_IT_SERVICE_ROLE_KEY/);
  });
  it("accepts a throwaway project and trims a trailing slash", () => {
    const r = integrationConfig({ ...good, MFA_IT_SUPABASE_URL: good.MFA_IT_SUPABASE_URL + "/" });
    expect(r).toEqual({ enabled: true, url: "https://abcdefghijklmnop.supabase.co", anonKey: "anon", serviceKey: "service" });
  });
  it("refuses the live project however the URL is written", () => {
    for (const url of [
      "https://" + LIVE_PROJECT_REF + ".supabase.co",
      "https://" + LIVE_PROJECT_REF + ".supabase.co/",
      "HTTPS://" + LIVE_PROJECT_REF.toUpperCase() + ".supabase.co",
      "https://" + LIVE_PROJECT_REF + ".supabase.co/rest/v1",
    ]) {
      const r = integrationConfig({ ...good, MFA_IT_SUPABASE_URL: url });
      expect(r.enabled, url).toBe(false);
      expect(r.refused, url).toBe(true);
    }
  });
  it("is never fooled into using the SUPABASE_* variables meant for the live site", () => {
    const r = integrationConfig({ MFA_IT: "1", SUPABASE_URL: "https://" + LIVE_PROJECT_REF + ".supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s" });
    expect(r.enabled).toBe(false);
    expect(r.refused).toBeUndefined();
  });
  it("only accepts a hosted https://<ref>.supabase.co address", () => {
    for (const url of ["http://abcdefghijklmnop.supabase.co", "https://example.com", "https://abc.supabase.co.evil.test", "not a url"]) {
      expect(integrationConfig({ ...good, MFA_IT_SUPABASE_URL: url }).enabled, url).toBe(false);
    }
  });
});
