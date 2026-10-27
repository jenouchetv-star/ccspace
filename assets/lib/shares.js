// Chike's Creative Space - counting what gets shared
//
// Every Share option (copy the link, the phone's share sheet, Facebook, ...) records one anonymous
// row: which page and how. This file is only the part that decides WHAT is recorded and how the
// rows are added up for the admin Analytics page. It has no dependency on the DOM or the database,
// so index.html imports it for the live site and test/shares.test.js imports the very same code.

/** How a page can be shared, with the name the admin sees. The keys are the only values the
    database accepts (see supabase/share-events.sql). */
export const SHARE_METHODS = {
  native: "Phone share sheet",
  copy: "Copy link",
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Messenger",
  x: "X",
  pinterest: "Pinterest",
  whatsapp: "WhatsApp",
  email: "Email",
  text: "Text message",
};

/** The one row to record for a share, or null when it should not be recorded: an unknown method,
    or an address that is not on this site. Only the path is kept - never the query string or the
    #fragment, which is where a private access key could be. */
export function shareEvent(url, title, method, origin) {
  if (!Object.prototype.hasOwnProperty.call(SHARE_METHODS, method)) return null;
  let u;
  try { u = new URL(String(url || ""), origin); } catch (_e) { return null; }
  if (u.origin !== new URL(origin).origin) return null;
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "/";
  if (!path || path.length > 200) return null;
  return { path: path, title: String(title || "").replace(/\s+/g, " ").trim().slice(0, 200), method: method };
}

/** Adds up recorded shares: the total, each page ranked by how often it was shared (with how, and
    the title it most recently had), and each method ranked. `rows` are { path, title, method,
    created_at } in any order. */
export function summarizeShares(rows) {
  const pages = new Map();
  const methods = new Map();
  let total = 0;
  for (const r of rows || []) {
    if (!r || !r.path) continue;
    total++;
    let p = pages.get(r.path);
    if (!p) { p = { path: r.path, title: "", titleAt: "", count: 0, methods: {} }; pages.set(r.path, p); }
    p.count++;
    p.methods[r.method] = (p.methods[r.method] || 0) + 1;
    const at = String(r.created_at || "");
    if (r.title && at >= p.titleAt) { p.title = r.title; p.titleAt = at; }
    methods.set(r.method, (methods.get(r.method) || 0) + 1);
  }
  const rank = (a, b) => b.count - a.count || String(a.title || a.path).localeCompare(String(b.title || b.path));
  return {
    total: total,
    byContent: [...pages.values()].map((p) => ({ path: p.path, title: p.title || p.path, count: p.count,
      methods: Object.entries(p.methods).map(([m, count]) => ({ method: m, label: SHARE_METHODS[m] || m, count: count })).sort(rank) })).sort(rank),
    byMethod: [...methods.entries()].map(([m, count]) => ({ method: m, label: SHARE_METHODS[m] || m, count: count })).sort(rank),
  };
}
