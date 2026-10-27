// A tiny in-memory stand-in for the slice of supabase-js that the `portal` Edge
// Function uses, so test/portalFunction.test.js can run the REAL function code
// (supabase/functions/portal/index.ts) with no network, no database and no email.
// vitest.config.js points the function's `jsr:@supabase/supabase-js@2` import here.
//
// It is deliberately small: select / insert / update / delete with eq, gte, gt
// and is filters, maybeSingle, head+count, and rpc. Rows are stored exactly as
// given (a `data` jsonb column is just an object), and every call returns
// copies, so a test cannot change the "database" by accident.

export const tables = {};

export function resetTables(seed) {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const [name, rows] of Object.entries(seed || {})) tables[name] = JSON.parse(JSON.stringify(rows));
}

const copy = (v) => JSON.parse(JSON.stringify(v));
const PRIMARY = { subscribers: "id", portal_entries: "id", portal_tokens: "token_hash", portal_sessions: "token_hash", portal_game_files: "id" };

class Query {
  constructor(table) {
    this.table = table;
    this.op = "select";
    this.filters = [];
    this.payload = null;
    this.returning = false;
    this.opts = {};
    this.one = false;
  }
  select(_cols, opts) {
    if (this.op === "select") this.opts = opts || {};
    else this.returning = true;
    return this;
  }
  insert(v) { this.op = "insert"; this.payload = v; return this; }
  update(v) { this.op = "update"; this.payload = v; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  gte(c, v) { this.filters.push((r) => String(r[c]) >= String(v)); return this; }
  gt(c, v) { this.filters.push((r) => String(r[c]) > String(v)); return this; }
  is(c, v) { this.filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)); return this; }
  maybeSingle() { this.one = true; return this; }
  then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }

  run() {
    const rows = (tables[this.table] = tables[this.table] || []);
    const hit = (r) => this.filters.every((f) => f(r));
    if (this.op === "insert") {
      const key = PRIMARY[this.table];
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const row of incoming) {
        if (key && rows.some((r) => r[key] === row[key])) return { data: null, error: { message: "duplicate key value" } };
        rows.push({ created_at: new Date().toISOString(), ...copy(row) });
      }
      return { data: null, error: null };
    }
    if (this.op === "update") {
      const changed = [];
      for (const r of rows) if (hit(r)) { Object.assign(r, copy(this.payload)); changed.push(copy(r)); }
      return { data: this.returning ? changed : null, error: null };
    }
    if (this.op === "delete") {
      tables[this.table] = rows.filter((r) => !hit(r));
      return { data: null, error: null };
    }
    const found = rows.filter(hit).map(copy);
    if (this.opts.head) return { data: null, count: found.length, error: null };
    if (this.one) return { data: found[0] ?? null, error: null };
    return { data: found, count: this.opts.count ? found.length : undefined, error: null };
  }
}

export function createClient() {
  return {
    from: (table) => new Query(table),
    rpc: async () => ({ data: null, error: null }),
  };
}
