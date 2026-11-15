// Sound Space on the site (index.html): its Studio entry (still Coming soon), how the full-window stage opens it,
// the Studio page words, its card pictures, and the admin Studio page's "Sound Space usage" card.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const E = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The text of one top-level function in index.html, from its name to the closing brace at the start of a line. */
function fn(name) {
  const start = index.indexOf("function " + name + "(");
  if (start < 0) return "";
  const end = index.indexOf("\n}\n", start);
  return index.slice(start, end + 2);
}
const apps = () => {
  const src = (index.match(/const STUDIO_APPS = (\[[\s\S]*?\n\]);/) || [])[1];
  return src ? new Function("return " + src)() : [];
};
const sound = () => apps().find((a) => a.id === "sound") || {};

/** JPEG width and height, read from its first start-of-frame marker. */
function jpegSize(path) {
  const b = readFileSync(path);
  let i = 2;
  while (i < b.length) {
    const marker = b[i + 1], len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [0, 0];
}

describe("Sound Space on the Studio page", () => {
  it("the Studio card no longer promises voice recording", () => {
    expect(index).not.toMatch(/record your own voice/i);
    expect(index).not.toMatch(/your own voice/i);
  });

  it("stays Coming soon until launch", () => {
    const s = sound();
    expect(s.live).toBe(false);
    expect(s.members).toBe(true);
    expect(s.path).toBe("assets/apps/sound-space.html");
    expect(s.appIcon).toBe("assets/studio/sound-space-icon.svg");
    expect(s.icon).toBe("audio-lines");
  });

  it("has a picture of each look, with words for the picture", () => {
    const s = sound();
    expect(s.preview).toBe("assets/studio/sound-space-preview.jpg");
    expect(s.previewLight).toBe("assets/studio/sound-space-preview-light.jpg");
    expect(String(s.previewAlt || "").length).toBeGreaterThan(40);
    expect(s.previewAlt).toMatch(/Sound Space/);
  });

  it("the card pictures are real files, the same size as Art Space's and small enough", () => {
    const s = sound();
    for (const p of [s.preview, s.previewLight, "assets/studio/sound-space-splash.jpg"]) {
      const url = new URL("../" + p, import.meta.url);
      expect(existsSync(url), p).toBe(true);
      expect(jpegSize(url), p).toEqual(jpegSize(new URL("../assets/studio/art-space-hero-ui-2.jpg", import.meta.url)));
      expect(statSync(url).size, p).toBeLessThan(260_000);
    }
  });

  it("says what is really in it: the counts match the app's own lists", () => {
    const load = (f) => readFileSync(new URL("../assets/apps/sound-space/" + f, import.meta.url), "utf8");
    const stub = { indexedDB: undefined };
    for (const f of ["model.js", "instruments.js", "library.js", "lessons.js"]) new Function("window", load(f))(stub);
    const S = stub.SoundSpace;
    const fb = (key) => (index.match(new RegExp('\\{ key:"' + key + '"[^\\n]*?fb:"([^"]*)"')) || [])[1] || "";
    const text = fb("soundText"), features = fb("soundFeatures");
    expect(text).toContain(S.instruments.LIST.length + " instruments");
    expect(features).toContain(S.instruments.LIST.length + " instruments");
    expect(features).toContain(S.library.PATTERNS.length + " beats and patterns");
    expect(features).toContain(S.lessons.LESSONS.length + " song lessons");
    for (const t of [text, features]) {
      expect(t).not.toMatch(/voice|microphone|\bmic\b|hundreds/i);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(features.split(" · ").length).toBeGreaterThanOrEqual(3);
  });
});

describe("opening Sound Space", () => {
  const open = new Function("openGameStage", "slotText", fn("openStudioStage") + "; return openStudioStage;");
  const stage = new Function("E", "nameHTML", "ic", fn("gameStage") + "; return gameStage;")(E, (s) => E(s), () => "");
  const opened = (s) => { let got = null; open((g) => { got = g; }, (_p, k) => k)(s); return got; };
  const allowOf = (g) => (stage(g).match(/ allow="([^"]*)"/) || [])[1];

  it("opens without the camera, with a music keyboard allowed", () => {
    const g = opened(sound());
    expect(g.bare).toBe(true);
    expect(g.path).toBe("assets/apps/sound-space.html");
    expect(g.sharePath).toBe("/create/studio/sound");
    const allow = allowOf(g);
    expect(allow).toBeTruthy();
    expect(allow).not.toMatch(/camera|microphone/);
    expect(allow).toMatch(/\bmidi\b/);
    expect(stage(g)).toMatch(/sandbox="[^"]*allow-downloads[^"]*allow-modals/);
  });

  it("Art Space opens as before", () => {
    const g = opened(apps().find((a) => a.id === "art"));
    expect(allowOf(g)).toBe("clipboard-write; web-share");
  });

  it("an admin can open its address before launch; nobody else can", () => {
    const view = fn("viewStudioApp");
    expect(view).toMatch(/!s\.live && !adminSeesAll\(\)/);
    expect(view).toMatch(/!s\.path/);
  });
});

describe("the admin Studio page's Sound Space usage card", () => {
  const studioBytesText = (n) => n + " B";
  const stats = (d, days) => new Function("E", "studioBytesText", fn("soundUsageStatsHTML") + "; return soundUsageStatsHTML;")(E, studioBytesText)(d, days);
  const data = { members: 3, songs: 7, bytes: 1234, new7: 2, new30: 5, active7: 2, opened: 40, opened_before: 20,
    signin_shown: 9, signed_in: 4, song_played: 31, song_exported: 6, by_member: [] };

  it("shows the numbers from sound_space_usage as tiles", () => {
    const html = stats(data, 30);
    for (const label of ["Times opened", "Saw Sign in", "Songs played", "Exported", "Members", "Active 7d", "Songs", "New 7d", "Storage"]) {
      expect(html, label).toContain("<span>" + label + "</span>");
    }
    expect(html).toContain(">40<");
    expect(html).toContain("4 signed in");
    expect(html).toContain("1234 B");
    expect(html).toContain("5 in 30d");
    expect(html).toContain("100%");
    expect(html).not.toMatch(/data-count="studio-/);
    expect(html).not.toMatch(/studio-up|studio-down/);
  });

  it("shows no change for All time", () => {
    expect(stats(data, 0)).not.toContain("%</small>");
  });

  it("sits on the page with its own range buttons and refresh, reading sound_space_usage", () => {
    const page = fn("adminStudio");
    expect(page).toContain("Sound Space usage");
    expect(page).toContain("soundUsageStatsHTML(");
    expect(page).toContain('data-act="sound-range"');
    expect(page).toContain('data-act="sound-refresh"');
    expect(page).toContain("Art Space usage");
    expect(page).toContain("studioLimitsCardHTML(");
    expect(index).toContain('"sound-range": ');
    expect(index).toContain('"sound-refresh": ');
    expect(index).toContain('sb.rpc("sound_space_usage", { range_days: ');
    expect(index).not.toMatch(/sound_space_daily/);
  });

  it("uses no emojis, orange or green", () => {
    const text = fn("soundUsageStatsHTML") + fn("adminStudio");
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(text.toLowerCase()).not.toMatch(/orange|green|#1f7a55|#2ba88e/);
  });
});

describe("the Sound Space row on the Studio page", () => {
  const SLOT_FB = {};
  for (const m of index.matchAll(/\{ key:"(\w+)", section:"Creative Space Studio"[^\n]*?fb:"([^"]*)"/g)) SLOT_FB[m[1]] = m[2];
  /** viewCreateStudio and its parts, run on a copy of STUDIO_APPS with Sound Space live or not, as a visitor or an admin. */
  function studioPage({ live, admin }) {
    const list = apps().map((a) => (a.id === "sound" ? Object.assign({}, a, { live }) : a));
    const env = {
      STUDIO_APPS: list, studioSettings: () => ({ live: true }), adminSeesAll: () => admin, notFound: () => "notfound",
      slot: (_p, k) => E(SLOT_FB[k] ?? k), slotText: (_p, k) => SLOT_FB[k] ?? k, slotLead: (_p, k) => "<b>LEAD:" + k + "</b>",
      ic: (n) => '<i data-lucide="' + n + '"></i>', E, portalIsSubscriber: () => false, artAppInstalled: () => false,
      slotDef: (_p, k) => (k in SLOT_FB ? {} : null)
    };
    const names = Object.keys(env);
    const body = "let STUDIO_APP_OPENED = '';\n" + ["viewCreateStudio", "studioInsideBox", "studioSoonBox", "studioAppCard", "studioSoundBox"].map(fn).join("\n") + "\nreturn viewCreateStudio();";
    return new Function(...names, body)(...names.map((k) => env[k]));
  }
  const rows = (h) => h.split('<div class="studioart__row').slice(1);
  const soonList = (h) => (h.split('class="studio-soon__list"')[1] || "").split("</ul>")[0];

  it("while Sound Space is Coming soon, a visitor sees it only in the Coming soon box", () => {
    const h = studioPage({ live: false, admin: false });
    expect(h).not.toContain('aria-label="Launch Sound Space"');
    expect(soonList(h)).toContain('data-id="sound"');
    expect(rows(h)).toHaveLength(2);                                   // Art Space, then Coming soon
  });

  it("an admin sees the Sound Space row before launch, marked as hidden, and it stays in Coming soon", () => {
    const h = studioPage({ live: false, admin: true });
    const r = rows(h);
    expect(r).toHaveLength(3);
    expect(r[1]).toContain('aria-label="Launch Sound Space"');
    expect(r[1]).toMatch(/card__badge chip chip--ink"><i data-lucide="eye-off"><\/i> Only admins see this/);
    expect(r[1]).not.toContain("Subscribers only");
    expect(soonList(h)).toContain('data-id="sound"');
  });

  it("once live, Sound Space has its own row between Art Space and Coming soon, and leaves Coming soon", () => {
    const h = studioPage({ live: true, admin: false });
    const r = rows(h);
    expect(r).toHaveLength(3);
    expect(r[0]).toContain('aria-label="Launch Art Space"');
    const sound = r[1];
    expect(r[2]).toMatch(/^ studioart__row--soon/);
    expect(soonList(h)).not.toContain('data-id="sound"');
    expect(soonList(h)).toContain('data-id="book"');
    // its pictures, its words, a black Beta badge and a blue Launch button
    expect(sound).toContain('src="assets/studio/sound-space-preview.jpg"');
    expect(sound).toContain('src="assets/studio/sound-space-preview-light.jpg"');
    expect(sound).toContain('data-act="studio-theme"');
    expect(sound).toContain('<p class="studio-card__lead"><b>LEAD:soundText</b></p>');
    expect(sound).toMatch(/<span class="chip chip--ink"[^>]*>Beta<\/span>/);
    expect(sound).toMatch(/class="btn btn--sm btn--cyan" data-act="open-studio-app" data-id="sound" aria-label="Launch Sound Space"/);
    expect(sound).toContain("Subscribers only");
    expect(sound).not.toContain('data-act="art-install"');
    for (const f of SLOT_FB.soundFeatures.split(" · ")) expect(sound).toContain(E(f));
    expect(sound).toContain("Inside Sound Space");
    // Art Space's card is as it was: its own lead and text, and Beta
    expect(r[0]).toContain("This is your space to make something original!");
    expect(r[0]).toMatch(/<span class="chip chip--ink"[^>]*>Beta<\/span>/);
  });

  it("the btn--cyan button is the site's blue, and chip--ink is black", () => {
    expect(index).toMatch(/\.chip--ink\{ background:var\(--ink\); color:var\(--paper\); \}/);
  });
});
