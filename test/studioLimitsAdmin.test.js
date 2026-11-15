// The admin Studio page's space limits (index.html): the "Space limits" card, the Limit column and the Change row in
// "By member", and how they call studio_limits_set / studio_member_limit_set. The helpers between the
// STUDIO-LIMITS markers are run for real with small stand-ins for the page's E(), ic(), formatBytes() and fmtDate().
// All addresses are made-up ones on example.test.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = (index.split("/* STUDIO-LIMITS:BEGIN */")[1] || "").split("/* STUDIO-LIMITS:END */")[0];
const E = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const L = new Function("E", "ic", "formatBytes", "fmtDate", block + `; return { STUDIO_LIMIT_USUAL, studioMB, studioLimitParse, studioLimitsRead,
  studioLimitsChanged, studioLimitsArgs, studioLimitsSave, studioLimitsCardHTML, studioMemberLimit, studioStorageHTML, studioLimitCellHTML,
  studioBytesText, studioMemberTableHTML, studioMemberLimitRead, studioMemberLimitSave };`)(E, (n) => `<i data-lucide="${n}"></i>`, (n) => (n / 1048576).toFixed(1) + " MB", (d) => String(d || "--"));

/** What studio_limits_get() returns with nothing saved, with optional changes per app and members' own limits. */
function limitsOf(changes = {}, members = []) {
  const out = { members };
  for (const app of ["art", "sound"]) {
    const usual = { ...L.STUDIO_LIMIT_USUAL[app] };
    const now = { ...usual, ...(changes[app] || {}) };
    out[app] = { ...now, defaults: usual, custom: Object.fromEntries(Object.keys(usual).map((k) => [k, (changes[app] || {})[k] !== undefined])) };
  }
  return out;
}
const inputs = (html) => Object.fromEntries([...html.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const fakeRpc = (data = { ok: 1 }, error = null) => {
  const calls = [];
  const rpc = async (name, args) => { calls.push({ name, args }); return { data, error }; };
  return { calls, rpc };
};

describe("the Space limits card", () => {
  it("is found in index.html", () => {
    expect(block.length).toBeGreaterThan(1000);
  });

  it("shows both apps' limits in MB and items, with the usual words", () => {
    const html = L.studioLimitsCardHTML({ limitsStatus: "ready", limits: limitsOf({ art: { max_items: 300, max_account_bytes: 250_000_000 } }), limitsErrors: {}, limitsDraft: {} });
    expect(inputs(html)).toEqual({
      "lim-art-max_items": "300", "lim-sound-max_items": "200",
      "lim-art-max_account_bytes": "250", "lim-sound-max_account_bytes": "20",
      "lim-art-max_item_bytes": "3", "lim-sound-max_item_bytes": "0.5",
      "lim-art-max_saves_per_hour": "600", "lim-sound-max_saves_per_hour": "600",
    });
    expect(html).toContain('data-act="save-studio-limits"');
    expect(html).toContain("<th>Art Space</th><th>Sound Space</th>");
    for (const words of ["Items each member can save", "Total space for each member", "Largest single item", "Saves an hour", "pictures", "songs"]) expect(html).toContain(words);
    expect(html).toMatch(/<button type="submit" class="admin-btn admin-btn--sm admin-btn--primary"[^>]*>[^]*?Save limits<\/button>/);
    expect(html).toContain('data-act="studio-limits-usual"');
    expect(html).toContain("Back to the usual limits");
    expect(html).toContain("Lowering a limit never deletes anything. A member already over it keeps everything, but can't add more until they make room. Each change goes in the activity log.");
    expect(html).toContain('aria-label="Sound Space largest song in MB"');
    expect(html).toContain('class="admin-table-wrap');      // scrolls sideways on a phone
  });

  it("keeps what the admin typed and shows the range in plain words next to a bad value", () => {
    const html = L.studioLimitsCardHTML({ limitsStatus: "ready", limits: limitsOf(), limitsDraft: { "lim-art-max_items": "5000" },
      limitsErrors: { "lim-art-max_items": "Art Space pictures each member can save: use a whole number from 1 to 2,000." } });
    expect(inputs(html)["lim-art-max_items"]).toBe("5000");
    expect(html).toMatch(/name="lim-art-max_items"[^>]*aria-invalid="true"/);
    expect(html).toContain("use a whole number from 1 to 2,000.");
    expect(html).toContain('role="alert"');
  });

  it("says so while loading, and when the limits can't be read", () => {
    expect(L.studioLimitsCardHTML({ limitsStatus: "loading", limitsErrors: {}, limitsDraft: {} })).toContain("Loading");
    const bad = L.studioLimitsCardHTML({ limitsStatus: "error", limitsError: "not authorized", limitsErrors: {}, limitsDraft: {} });
    expect(bad).toContain("Could not load the limits: not authorized");
    expect(bad).toContain('data-act="studio-limits-retry"');
    expect(bad).not.toContain("Save limits");
  });
});

describe("checking the numbers", () => {
  it("turns MB into bytes (1 MB = 1,000,000 bytes) and allows decimals for space", () => {
    expect(L.studioLimitParse("sound", "max_item_bytes", "0.5")).toEqual({ value: 500_000, error: "" });
    expect(L.studioLimitParse("art", "max_account_bytes", "1,000")).toEqual({ value: 1_000_000_000, error: "" });
    expect(L.studioLimitParse("art", "max_item_bytes", " 2.25 ")).toEqual({ value: 2_250_000, error: "" });
    expect(L.studioLimitParse("art", "max_items", "300")).toEqual({ value: 300, error: "" });
    expect(L.studioMB(500_000)).toBe("0.5");
    expect(L.studioMB(100_000_000)).toBe("100");
    expect(L.studioMB(2_250_000)).toBe("2.25");
  });

  it("refuses values outside the safe ranges, in plain words with the range", () => {
    const err = (app, key, raw) => L.studioLimitParse(app, key, raw).error;
    expect(err("art", "max_items", "0")).toBe("Art Space pictures each member can save: use a whole number from 1 to 2,000.");
    expect(err("sound", "max_items", "2001")).toBe("Sound Space songs each member can save: use a whole number from 1 to 2,000.");
    expect(err("art", "max_items", "2.5")).toMatch(/whole number/);
    expect(err("art", "max_account_bytes", "0.5")).toBe("Art Space total space: use 1 to 1,000 MB.");
    expect(err("sound", "max_account_bytes", "1001")).toBe("Sound Space total space: use 1 to 1,000 MB.");
    expect(err("art", "max_item_bytes", "11")).toBe("Art Space largest picture: use 0.1 to 10 MB.");
    expect(err("art", "max_item_bytes", "0.05")).toBe("Art Space largest picture: use 0.1 to 10 MB.");
    expect(err("sound", "max_item_bytes", "3")).toBe("Sound Space largest song: use 0.05 to 2 MB.");
    expect(err("sound", "max_saves_per_hour", "59")).toBe("Sound Space saves an hour: use a whole number from 60 to 3,600.");
    expect(err("art", "max_saves_per_hour", "3601")).toMatch(/60 to 3,600/);
    expect(err("art", "max_items", "")).toMatch(/1 to 2,000/);
    expect(err("art", "max_items", "lots")).toMatch(/1 to 2,000/);
    expect(err("art", "max_items", "1e3")).toMatch(/1 to 2,000/);
  });

  it("reads the whole card, and lists every bad value", () => {
    const form = { "lim-art-max_items": "300", "lim-art-max_account_bytes": "250", "lim-art-max_item_bytes": "3", "lim-art-max_saves_per_hour": "600",
      "lim-sound-max_items": "200", "lim-sound-max_account_bytes": "20", "lim-sound-max_item_bytes": "0.5", "lim-sound-max_saves_per_hour": "600" };
    const ok = L.studioLimitsRead((n) => form[n]);
    expect(ok.errors).toEqual({});
    expect(ok.values.art).toEqual({ max_items: 300, max_account_bytes: 250_000_000, max_item_bytes: 3_000_000, max_saves_per_hour: 600 });
    const bad = L.studioLimitsRead((n) => ({ ...form, "lim-art-max_items": "0", "lim-sound-max_item_bytes": "9" })[n]);
    expect(Object.keys(bad.errors).sort()).toEqual(["lim-art-max_items", "lim-sound-max_item_bytes"]);
    expect(bad.raw["lim-sound-max_item_bytes"]).toBe("9");
  });
});

describe("Save limits", () => {
  const form = (art, sound) => L.studioLimitsRead((n) => {
    const [, app, key] = n.split(/^lim-(art|sound)-/);
    const v = (app === "art" ? art : sound)[key];
    return v !== undefined ? String(v) : { max_items: "200", max_account_bytes: app === "art" ? "100" : "20", max_item_bytes: app === "art" ? "3" : "0.5", max_saves_per_hour: "600" }[key];
  }).values;

  it("only sends the apps that changed", () => {
    const cur = limitsOf();
    expect(L.studioLimitsChanged(cur, form({}, {}))).toEqual([]);
    expect(L.studioLimitsChanged(cur, form({ max_items: 300 }, {}))).toEqual(["art"]);
    expect(L.studioLimitsChanged(cur, form({ max_items: 300 }, { max_item_bytes: "1" }))).toEqual(["art", "sound"]);
    // going back to the usual number on a custom limit is a change too
    expect(L.studioLimitsChanged(limitsOf({ sound: { max_items: 50 } }), form({}, {}))).toEqual(["sound"]);
  });

  it("calls studio_limits_set with bytes (MB x 1,000,000), and null for a value that is the usual one", async () => {
    const { calls, rpc } = fakeRpc({ art: {}, sound: {}, members: [] });
    const values = form({ max_items: 300, max_account_bytes: "250" }, { max_item_bytes: "1.5" });
    const out = await L.studioLimitsSave(rpc, ["art", "sound"], values);
    expect(out).toEqual({ art: {}, sound: {}, members: [] });
    expect(calls).toEqual([
      { name: "studio_limits_set", args: { p_app: "art", p_max_items: 300, p_max_account_bytes: 250_000_000, p_max_item_bytes: null, p_max_saves_per_hour: null } },
      { name: "studio_limits_set", args: { p_app: "sound", p_max_items: null, p_max_account_bytes: null, p_max_item_bytes: 1_500_000, p_max_saves_per_hour: null } },
    ]);
    expect(L.studioLimitsArgs("sound", null)).toEqual({ p_app: "sound", p_max_items: null, p_max_account_bytes: null, p_max_item_bytes: null, p_max_saves_per_hour: null });
  });

  it("stops and reports the server's error", async () => {
    const { rpc } = fakeRpc(null, { message: "Saves an hour must be between 60 and 3,600." });
    await expect(L.studioLimitsSave(rpc, ["art"], form({ max_items: 300 }, {}))).rejects.toThrow("Saves an hour must be between 60 and 3,600.");
  });

  it("is wired to the form, the Back to the usual limits confirm, and the activity log", () => {
    const submit = index.split('if (act === "save-studio-limits"){')[1].split("\n  }\n")[0];
    expect(submit).toContain("studioLimitsRead(");
    expect(submit).toContain("studioLimitsSave(");
    expect(submit).toMatch(/toast\("Space limits saved/);
    expect(index).toContain('"studio-limits-usual": ');
    const confirm = index.split('"studio-limits-usual-confirm": ')[1].split("\n  },\n")[0];
    expect(confirm).toContain("studioLimitsSave(");
    expect(confirm).toContain("null");
    expect(index).toContain('"studio-limits-retry": ');
  });
});

describe("By member: the Limit column and the Change row", () => {
  const art = [
    { email: "parent.one@example.test", pictures: 48, paint: 40, pixel: 8, first: "2026-11-06", last: 1, bytes: 21_400_000 },
    { email: "classroom.k2@example.test", pictures: 200, paint: 200, pixel: 0, first: "2026-11-06", last: 1, bytes: 96_000_000 },
    { email: "Art.Family@example.test", pictures: 120, paint: 100, pixel: 20, first: "2026-11-06", last: 1, bytes: 143_200_000 },
  ];
  const limits = limitsOf({}, [{ app: "art", email: "art.family@example.test", max_items: 300, max_account_bytes: 300_000_000 }]);

  it("works out each member's limits: their own, else the app's (from the usage row when it has them)", () => {
    expect(L.studioMemberLimit("art", art[0], limits)).toEqual({ items: 200, bytes: 100_000_000, custom: false });
    expect(L.studioMemberLimit("art", art[2], limits)).toEqual({ items: 300, bytes: 300_000_000, custom: true });
    expect(L.studioMemberLimit("sound", { email: "x@example.test", max_items: 9, max_bytes: 9_000_000, custom: true }, limits)).toEqual({ items: 9, bytes: 9_000_000, custom: true });
    expect(L.studioMemberLimit("sound", { email: "x@example.test" }, null)).toEqual({ items: 200, bytes: 20_000_000, custom: false });
  });

  it("shows Standard in muted text, or a black badge for custom limits, and when a member is at a limit", () => {
    expect(L.studioLimitCellHTML({ items: 200, bytes: 100_000_000, custom: false }, 48, 21_400_000)).toBe('<span class="studio-std">Standard</span>');
    expect(L.studioLimitCellHTML({ items: 300, bytes: 300_000_000, custom: true }, 120, 1)).toBe('<span class="studio-badge">Custom · 300 · 300 MB</span>');
    expect(L.studioLimitCellHTML({ items: 200, bytes: 100_000_000, custom: false }, 200, 1)).toContain("at the item limit");
    expect(L.studioLimitCellHTML({ items: 200, bytes: 100_000_000, custom: false }, 10, 100_000_000)).toContain("at the space limit");
    const css = index.split(".studio-badge{")[1].split("}")[0];
    expect(css).toMatch(/background:#111114/);
  });

  it("fills a storage bar against the member's own limit, red at 90% or more", () => {
    expect(L.studioStorageHTML(21_400_000, 100_000_000)).toContain('style="width:21%"');
    expect(L.studioStorageHTML(21_400_000, 100_000_000)).not.toContain("studio-bar--full");
    expect(L.studioStorageHTML(90_000_000, 100_000_000)).toContain("studio-bar--full");
    expect(L.studioStorageHTML(150_000_000, 100_000_000)).toContain('style="width:100%"');
    // the same MB as the limits (1 MB = 1,000,000 bytes), so 19 MB of 20 MB reads as such
    expect(L.studioStorageHTML(19_000_000, 20_000_000)).toMatch(/^19\.0 MB<span class="studio-bar"><i class="studio-bar--full" style="width:95%">/);
    expect(L.studioStorageHTML(30_000, 20_000_000)).toMatch(/^30 KB/);
    // and the page's overall Storage figure uses the same units
    expect(L.studioBytesText(248_500_000)).toBe("248.5 MB");
    expect(L.studioBytesText(1_250_000_000)).toBe("1.25 GB");
    expect(L.studioBytesText(0)).toBe("—");
    expect(index.split("function adminStudio(){")[1].split("\n}\n")[0]).toContain('stat(E(studioBytesText(d.bytes)), "Storage")');
    expect(index.split(".studio-bar i.studio-bar--full{")[1].split("}")[0]).toContain("#C0262D");
  });

  it("draws the table with a Limit column and a Change button for each member", () => {
    const html = L.studioMemberTableHTML("art", art, { limits, edit: null });
    expect(html).toContain("<th>Limit</th>");
    expect(html.match(/<th[ >]/g)).toHaveLength(5);                    // the draft's columns: member, pictures, storage, limit, change
    expect(html).toContain("40 paint · 8 pixel · first 2026-11-06 · last saved");   // the rest stays, under the email
    expect(L.studioMemberTableHTML("sound", [{ email: "s@example.test", songs: 2, first: "2026-11-14", last: 1, bytes: 10 }], { limits, edit: null })).not.toContain("paint");
    expect(html.match(/data-act="studio-limit-edit"/g)).toHaveLength(3);
    expect(html).toContain('data-email="art.family@example.test"');
    expect(html).toContain("Custom · 300 · 300 MB");
    expect(html).not.toContain("studio-edit");
    expect(L.studioMemberTableHTML("sound", [], { limits, edit: null })).toContain("No member has saved a song yet.");
  });

  it("opens the Change row under that member with their limits, the three buttons and the note", () => {
    const html = L.studioMemberTableHTML("art", art, { limits, edit: { app: "art", email: "classroom.k2@example.test" } });
    const at = html.indexOf('data-email="classroom.k2@example.test"');
    const edit = html.indexOf('class="studio-edit"');
    expect(edit).toBeGreaterThan(at);
    expect(edit).toBeLessThan(html.indexOf('data-email="art.family@example.test"'));
    const row = html.slice(edit);
    expect(row).toMatch(/id="slm-items"[^>]*value="200"/);
    expect(row).toMatch(/id="slm-mb"[^>]*value="100"/);
    expect(row).toContain("pictures");
    expect(row).toMatch(/class="admin-btn admin-btn--sm admin-btn--primary" data-act="studio-member-limit-save"[^>]*>[^<]*Save for this member/);
    expect(row).toContain('data-act="studio-member-limit-standard"');
    expect(row).toContain("Back to standard");
    expect(row).toContain('data-act="studio-limit-cancel"');
    expect(row).toContain("Only this member gets these limits. The largest item and saves an hour stay the same for everyone.");
    expect(html).toMatch(/data-act="studio-limit-edit"[^>]*data-email="classroom.k2@example.test"[^>]*aria-expanded="true"/);
  });

  it("saves a member's limits by email, in bytes, with an empty box meaning standard for that one", async () => {
    expect(L.studioMemberLimitRead("art", "400", "200")).toEqual({ items: 400, bytes: 200_000_000, errors: [] });
    expect(L.studioMemberLimitRead("sound", "", "40")).toEqual({ items: null, bytes: 40_000_000, errors: [] });
    expect(L.studioMemberLimitRead("sound", "0", "2000").errors).toEqual([
      "Sound Space songs each member can save: use a whole number from 1 to 2,000.", "Sound Space total space: use 1 to 1,000 MB."]);
    const { calls, rpc } = fakeRpc({ members: [] });
    await L.studioMemberLimitSave(rpc, "art", "classroom.k2@example.test", 400, 200_000_000);
    await L.studioMemberLimitSave(rpc, "art", "classroom.k2@example.test", null, null);
    expect(calls).toEqual([
      { name: "studio_member_limit_set", args: { p_app: "art", p_email: "classroom.k2@example.test", p_max_items: 400, p_max_account_bytes: 200_000_000 } },
      { name: "studio_member_limit_set", args: { p_app: "art", p_email: "classroom.k2@example.test", p_max_items: null, p_max_account_bytes: null } },
    ]);
  });

  it("is wired: the Change, Save, Back to standard and Cancel buttons, and the Art Space / Sound Space tabs", () => {
    for (const act of ["studio-limit-edit", "studio-limit-cancel", "studio-member-limit-save", "studio-member-limit-standard", "studio-member-tab"]) {
      expect(index, act).toContain(`"${act}": `);
    }
    const save = index.split('"studio-member-limit-save": ')[1].split("\n  },\n")[0];
    expect(save).toContain("studioMemberLimitRead(");
    expect(save).toContain("studioMemberLimitSave(");
    expect(save).toContain("toast(");
    expect(index).toContain('sb.rpc("sound_space_usage", { range_days: ');
    expect(index).toContain('sb.rpc("studio_limits_get")');
    const page = index.split("function adminStudio(){")[1].split("\n}\n")[0];
    expect(page).toContain("studioLimitsCardHTML(");
    expect(page).toContain("studioMemberTableHTML(");
    expect(page).toMatch(/role="tablist"/);
  });

  it("uses no emojis, orange or green", () => {
    const css = index.split("/* admin Studio space limits */")[1].split("\n\n")[0];
    for (const text of [block, css]) {
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text.toLowerCase()).not.toMatch(/orange|#f[0-9a-f]9[0-9a-f]{3}\b|green|#1f7a55|#2ba88e/);
    }
  });
});
