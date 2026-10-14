// Static guards on the admin 2FA SQL. They can't run SQL (that needs a real
// database), but they pin the properties that matter most and that a future
// edit could silently break:
//   * re-running migration.sql can never turn enforcement off,
//   * migration.sql and the standalone mfa-hardening.sql can't drift apart,
//   * the enforce / rollback files only flip the switch and define nothing,
//   * nothing else redefines is_active_admin().
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../supabase/", import.meta.url);
const read = (name) => readFileSync(new URL(name, dir), "utf8");
const stripComments = (sql) => sql.replace(/--[^\n]*/g, "");

function blocks(sql) {
  const out = {};
  const re = /-- BEGIN MFA-HARDENING:(\w+)\r?\n([\s\S]*?)-- END MFA-HARDENING:\1/g;
  let m;
  while ((m = re.exec(sql))) out[m[1]] = m[2].trim();
  return out;
}

const migration = read("migration.sql");
const migrationCode = stripComments(migration);
const standalone = read("mfa-hardening.sql");
const standaloneCode = stripComments(standalone);
const NAMES = ["settings", "is_active_admin", "handle_new_user", "accept_invite", "reset_log"];
// The switch table however it is written: admin_mfa_settings, public.admin_mfa_settings, "admin_mfa_settings".
const T = '(?:public\\.)?"?admin_mfa_settings"?';

describe("migration.sql cannot remove MFA enforcement when re-run", () => {
  it("defines is_active_admin exactly once, and it reads the persistent switch and the session", () => {
    const defs = migrationCode.match(/create\s+or\s+replace\s+function\s+(public\.)?is_active_admin\s*\(/gi) || [];
    expect(defs.length).toBe(1);
    const fn = blocks(migration).is_active_admin;
    expect(fn).toContain("admin_mfa_settings");
    expect(fn).toContain("enforce_after");
    expect(fn).toContain("aal2");
    expect(fn).toContain("auth.sessions");
    expect(fn).toContain("session_id");
  });

  it("never drops, truncates, deletes from or updates the switch (in migration.sql or the standalone file, schema-qualified or not)", () => {
    for (const [name, code] of [["migration.sql", migrationCode], ["mfa-hardening.sql", standaloneCode]]) {
      expect(code, name).not.toMatch(new RegExp("drop\\s+table[^;]*" + T, "i"));
      expect(code, name).not.toMatch(new RegExp("truncate[^;]*" + T, "i"));
      expect(code, name).not.toMatch(new RegExp("delete\\s+from\\s+" + T, "i"));
      expect(code, name).not.toMatch(new RegExp("update\\s+" + T, "i"));
      expect(code, name).not.toMatch(/drop\s+function[^;]*is_active_admin/i);
      expect(code, name).not.toMatch(new RegExp("alter\\s+table\\s+" + T + "[^;]*(drop|rename)", "i"));
    }
  });

  it("creates the switch only if it doesn't exist and seeds it with on conflict do nothing", () => {
    expect(migrationCode.match(/create\s+table\s+if\s+not\s+exists\s+admin_mfa_settings/gi).length).toBe(1);
    expect(migrationCode).not.toMatch(/create\s+table\s+admin_mfa_settings/i);
    const inserts = migrationCode.match(/insert\s+into\s+admin_mfa_settings[^;]*;/gi) || [];
    expect(inserts.length).toBeGreaterThan(0);
    for (const stmt of inserts) expect(stmt).toMatch(/on\s+conflict\s*\(id\)\s*do\s+nothing/i);
  });

  it("keeps the switch out of reach of anon and authenticated users", () => {
    const settings = blocks(migration).settings;
    expect(settings).toMatch(/enable\s+row\s+level\s+security/i);
    expect(settings).toMatch(/revoke\s+all\s+on\s+admin_mfa_settings\s+from\s+anon,\s*authenticated/i);
    expect(settings).not.toMatch(/create\s+policy/i);
  });
});

describe("invitation hardening", () => {
  it("only gives a profile to an auth user that was invited, whether invited_at is set on insert or just after", () => {
    const fn = blocks(migration).handle_new_user;
    expect(fn).toMatch(/new\.invited_at\s+is\s+null/i);
    expect(fn).toMatch(/after\s+insert\s+or\s+update\s+of\s+invited_at\s+on\s+auth\.users/i);
  });

  it("only lets an invited profile activate itself inside the 7-day window, and says so when it can't", () => {
    const fn = blocks(migration).accept_invite;
    expect(fn).toMatch(/u\.invited_at\s+is\s+not\s+null/i);
    expect(fn).toMatch(/interval\s+'7\s+days'/i);
    expect(fn).toMatch(/raise\s+exception/i);
  });
});

describe("audit log and session revocation", () => {
  it("keeps the reset log private and lets only service_role revoke sessions", () => {
    const b = blocks(migration).reset_log;
    expect(b).toMatch(/create\s+table\s+if\s+not\s+exists\s+mfa_reset_log/i);
    expect(b).toMatch(/revoke\s+all\s+on\s+mfa_reset_log\s+from\s+anon,\s*authenticated/i);
    expect(b).toMatch(/revoke\s+execute\s+on\s+function\s+public\.revoke_user_sessions\(uuid\)\s+from\s+public,\s*anon,\s*authenticated/i);
    expect(b).toMatch(/grant\s+execute\s+on\s+function\s+public\.revoke_user_sessions\(uuid\)\s+to\s+service_role/i);
  });
});

describe("mfa-hardening.sql mirrors migration.sql", () => {
  it("contains every hardened block, byte for byte", () => {
    const a = blocks(migration);
    const b = blocks(standalone);
    expect(Object.keys(a).sort()).toEqual([...NAMES].sort());
    expect(Object.keys(b).sort()).toEqual([...NAMES].sort());
    for (const n of NAMES) expect(b[n], "block " + n + " drifted").toBe(a[n]);
  });
});

describe("the enforce and rollback files only flip the switch", () => {
  for (const file of ["mfa-enforce.sql", "mfa-rollback.sql"]) {
    it(file + " is data-only", () => {
      const code = stripComments(read(file));
      expect(code).toMatch(/update\s+admin_mfa_settings/i);
      expect(code).not.toMatch(/\b(create|function|drop|alter|delete|insert|truncate)\b/i);
    });
  }
  it("enforcement starts after a short window, never later, and refuses while an admin is unenrolled; rollback clears it", () => {
    const enforceCode = stripComments(read("mfa-enforce.sql"));
    expect(enforceCode).toMatch(/interval\s+'3\s+days'/i);
    expect(enforceCode).toMatch(/least\s*\(/i);                                  // never pushes the date later
    expect(enforceCode).toMatch(/not\s+exists[\s\S]*auth\.mfa_factors[\s\S]*status\s*=\s*'verified'/i);   // refuses while someone is unenrolled
    expect(stripComments(read("mfa-rollback.sql"))).toMatch(/enforce_after\s*=\s*null/i);
  });
});

describe("nothing else redefines is_active_admin", () => {
  it("only migration.sql and mfa-hardening.sql do", () => {
    const others = readdirSync(dir).filter((f) => f.endsWith(".sql") && f !== "migration.sql" && f !== "mfa-hardening.sql");
    for (const f of others) {
      expect(stripComments(read(f)), f).not.toMatch(/function\s+(public\.)?is_active_admin\s*\(/i);
    }
  });
});
