// The site's side of the Subscriber’s Portal: the rules in assets/lib/portal.js, and how
// index.html wires the portal in (routes, the gate, the admin screens, sharing).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  PORTAL_LAYOUTS, portalEntryUrl, portalReadQuery, portalVideoEmbed, portalSafeUrl, portalParseGallery, portalFormatGallery,
  portalSlug, portalLinkUrl, portalBookPath, portalValidate, portalGateMessage, portalErrorState, portalEmailOk, PORTAL_CATEGORIES,
} from "../assets/lib/portal.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("a members-only game in the page", () => {
  it("plays from the code that came with the entry, in a sealed frame, never from a file address", () => {
    const game = body("portalGameHTML");
    const priv = game.slice(game.indexOf("if (e.privateGameId)"), game.indexOf("if (!path)"));
    expect(priv).toContain('data-act="portal-play-private"');
    expect(priv).toContain('srcdoc="');
    expect(priv).toContain('sandbox="allow-scripts allow-popups"');
    expect(priv).not.toContain("allow-same-origin");
    expect(priv).not.toMatch(/ src="/);
  });

  it("opens in the player with the entry's page as its share address, and admins read the code from the locked table", () => {
    const act = html.split('"portal-play-private": async (el) => {')[1].split("\n  },")[0];
    expect(act).toContain("srcdoc: html");
    expect(act).toContain('sharePath: "/newsletter/"');
    expect(act).toContain("loadPortalGameHtml(e.privateGameId)");
    expect(html).toContain('from("portal_game_files")');
  });

  it("starts a sealed game over without loading the whole site into its frame", () => {
    const reload = html.split('"game-reload": () => {')[1].split("\n  },")[0];
    expect(reload).toContain('frame.hasAttribute("srcdoc")');
    expect(reload.indexOf('hasAttribute("srcdoc")')).toBeLessThan(reload.indexOf("location.reload()"));
  });

  it("lets an admin paste a game's code in the entry editor, which goes to the locked table and never into the entry", () => {
    const fields = html.split("portalEntries: [")[1].split("\n  ],")[0];
    expect(fields).toContain('key:"privateGameCode", label:"Members-only game code", type:"textarea"');
    expect(fields).toContain('layouts:["game"]');
    const apply = html.split("async function portalApplyPrivateGame(c){")[1].split("\nfunction openPortalEditor")[0];
    expect(apply).toContain("delete c.privateGameCode");
    expect(apply).toContain('sb.from("portal_game_files").upsert(');
    expect(apply).toContain("CopilotLib.extractHtml(code)");
    expect(apply).toContain("a.blocked");
    expect(apply).not.toContain('from("game_files")');                  /* never the public games table */
    const save = html.split('if (act === "save-record"){')[1].split("\n    return;\n  }")[0];
    expect(save.indexOf("portalApplyPrivateGame(candidate)")).toBeGreaterThan(-1);
    expect(save.indexOf("portalApplyPrivateGame(candidate)")).toBeLessThan(save.indexOf("canSetStatus(col, candidate, wanted)"));
  });

  it("accepts pasted game code as a game, before it is saved", () => {
    const base = { title: "T", description: "d", category: "New games", publishedAt: "2026-10-01", layout: "game" };
    expect(portalValidate({ ...base, privateGameCode: "<html>...</html>" }, []).filter((v) => v.level === "error")).toEqual([]);
  });

  it("shows an animated cover, with a still picture for people who have reduced motion switched on", () => {
    const cover = body("portalCoverImg");
    expect(cover).toContain("<picture>");
    expect(cover).toContain('media="(prefers-reduced-motion: reduce)"');
    expect(cover).toContain("portalSafeUrl(e.coverStill)");                  /* the still is a site file or https address only */
    expect(cover).toContain("E(e.cover.src)");
    expect(body("portalGameHTML")).toContain("portalCoverImg(e)");
    expect(body("portalEntryHTML")).toContain("portalCoverImg(e)");
    for (const f of ["gravity-four-loop.gif", "gravity-four-loop-thumb.gif", "gravity-four.webp"]) expect(existsSync(new URL("../assets/games/" + f, import.meta.url))).toBe(true);
    /* the archive card looks for "<name>-thumb.<ext>" next to the cover: that file is the light, still version */
    expect(readFileSync(new URL("../assets/games/gravity-four-loop-thumb.gif", import.meta.url)).length).toBeLessThan(120000);
  });

  it("shows a game entry's cover picture above its Play button, but not when the game is on the page", () => {
    const game = body("portalGameHTML");
    expect(game).toContain("const cover = (e.cover && e.cover.src)");
    expect(game.split("return hero(").length - 1).toBe(3);                /* private game, site game and file launches */
    expect(game).toContain('<div class="pposter">');
    expect(game).toContain('<div class="pposter__cta">');
    expect(game).toContain('<div class="prow prow--hero">');              /* no cover: the buttons are a row of their own */
    const embed = game.slice(game.indexOf('e.gameMode === "embed"'));
    expect(embed.slice(0, embed.indexOf("return"))).not.toContain("cover");
  });

  it("counts a private game as a valid game entry", () => {
    const base = { title: "T", description: "d", category: "New games", publishedAt: "2026-10-01", layout: "game" };
    expect(portalValidate({ ...base }, []).some((v) => v.field === "gamePath")).toBe(true);
    expect(portalValidate({ ...base, privateGameId: "g1" }, []).filter((v) => v.level === "error")).toEqual([]);
  });
});

describe("links an entry can embed or offer", () => {
  it("turns YouTube and Vimeo links into embeds, and refuses every other site", () => {
    expect(portalVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(portalVideoEmbed("https://youtu.be/dQw4w9WgXcQ?t=4")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(portalVideoEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(portalVideoEmbed("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(portalVideoEmbed("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    for (const bad of ["", "https://evil.example/watch?v=dQw4w9WgXcQ", "http://youtu.be/dQw4w9WgXcQ", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://vimeo.com/abc", null]) {
      expect(portalVideoEmbed(bad)).toBeNull();
    }
  });

  it("only accepts https links or files on this site for downloads and games", () => {
    expect(portalSafeUrl("https://example.com/book.pdf")).toBe("https://example.com/book.pdf");
    expect(portalSafeUrl("games/new-game.html")).toBe("games/new-game.html");
    expect(portalSafeUrl("assets/ebooks/a-b_c.pdf")).toBe("assets/ebooks/a-b_c.pdf");
    expect(portalSafeUrl("books/reader.html?story=my-book")).toBe("books/reader.html?story=my-book");
    expect(portalBookPath({ bookId: "story-question-mark" })).toBe("books/reader.html?story=story-question-mark");
    expect(portalBookPath({ bookId: "x", bookPath: "books/reader.html?story=y" })).toBe("books/reader.html?story=y");
    expect(portalBookPath({ bookId: "../etc" })).toBe("");
    expect(portalBookPath({})).toBe("");
    for (const bad of ["", "javascript:alert(1)", "data:text/html,hi", "http://example.com/x", "//evil.example/x", "../secret", "games/../../x", "https://a b.test", "ftp://x.test/y", "https://x.test/\"onload=\""]) {
      expect(portalSafeUrl(bad)).toBe("");
    }
  });

  it("reads and writes the one-photo-per-line gallery format", () => {
    const lines = ["a.jpg | Chike painting | Day one", "b.jpg | A rocket", "c.jpg", "  ", " | no picture"];
    expect(portalParseGallery(lines)).toEqual([
      { src: "a.jpg", alt: "Chike painting", caption: "Day one" },
      { src: "b.jpg", alt: "A rocket", caption: "" },
      { src: "c.jpg", alt: "", caption: "" },
    ]);
    expect(portalParseGallery("x.jpg | y\nz.jpg")).toHaveLength(2);
    expect(portalFormatGallery(portalParseGallery(lines))).toEqual(["a.jpg | Chike painting | Day one", "b.jpg | A rocket", "c.jpg"]);
    expect(portalParseGallery(undefined)).toEqual([]);
  });

  it("makes tidy page addresses", () => {
    expect(portalSlug("Spring Update: Big News & Games!")).toBe("spring-update-big-news-and-games");
    expect(portalSlug("   ")).toBe("");
    expect(portalSlug("x".repeat(90)).length).toBe(60);
  });
});

describe("sharing and one-time links", () => {
  it("shares the plain page address, never a private key", () => {
    expect(portalEntryUrl("https://www.example.test/", { slug: "spring-update" })).toBe("https://www.example.test/newsletter/spring-update");
    expect(portalEntryUrl("https://www.example.test", { id: "abc" })).toBe("https://www.example.test/newsletter/abc");
    expect(portalEntryUrl("https://www.example.test", { slug: "a" })).not.toMatch(/[?&](k|v)=/);
  });

  it("notices the verification link and the newsletter key in the address", () => {
    expect(portalReadQuery({ v: "tok" })).toEqual({ verify: "tok", key: "", hasSecret: true });
    expect(portalReadQuery({ k: "key.sig" })).toEqual({ verify: "", key: "key.sig", hasSecret: true });
    expect(portalReadQuery({})).toEqual({ verify: "", key: "", hasSecret: false });
    expect(portalReadQuery(undefined).hasSecret).toBe(false);
  });
});

describe("what an entry needs before it can be published", () => {
  const base = { title: "T", description: "D", category: "Stories", publishedAt: "2026-10-01", cover: { src: "a.jpg", alt: "alt" }, layout: "article", body: "<p>Hi</p>" };
  const errors = (e, others) => portalValidate(e, others).filter((v) => v.level === "error").map((v) => v.field);

  it("accepts a complete entry in each of the five layouts", () => {
    expect(PORTAL_LAYOUTS.map((l) => l.id)).toEqual(["article", "video", "game", "ebook", "gallery"]);
    expect(errors(base)).toEqual([]);
    expect(errors({ ...base, layout: "video", body: "", videoUrl: "https://youtu.be/dQw4w9WgXcQ" })).toEqual([]);
    expect(errors({ ...base, layout: "game", body: "", gamePath: "games/new.html" })).toEqual([]);
    expect(errors({ ...base, layout: "ebook", body: "", bookId: "story-question-mark" })).toEqual([]);
    expect(errors({ ...base, layout: "ebook", body: "", bookPath: "books/reader.html?story=my-new-book" })).toEqual([]);
    expect(errors({ ...base, layout: "gallery", body: "", gallery: ["a.jpg | alt"] })).toEqual([]);
  });

  it("asks for the basics: title, description, category, a real date", () => {
    expect(errors({ layout: "article", body: "x" })).toEqual(["title", "description", "category", "publishedAt"]);
    expect(errors({ ...base, publishedAt: "soon" })).toEqual(["publishedAt"]);
  });

  it("asks for alt text with a cover, and warns when there is no cover", () => {
    expect(errors({ ...base, cover: { src: "a.jpg", alt: "" } })).toEqual(["cover.alt"]);
    expect(portalValidate({ ...base, cover: { src: "", alt: "" } }).filter((v) => v.level === "warn").map((v) => v.field)).toContain("cover.src");
  });

  it("asks for what each layout shows", () => {
    expect(errors({ ...base, layout: "article", body: " " })).toEqual(["body"]);
    expect(errors({ ...base, layout: "video", videoUrl: "" })).toEqual(["videoUrl"]);
    expect(errors({ ...base, layout: "video", videoUrl: "https://example.com/v.mp4" })).toEqual(["videoUrl"]);
    expect(errors({ ...base, layout: "game", gamePath: "" })).toEqual(["gamePath"]);
    expect(errors({ ...base, layout: "game", gamePath: "javascript:alert(1)" })).toEqual(["gamePath"]);
    expect(errors({ ...base, layout: "ebook" })).toEqual(["bookId"]);
    expect(errors({ ...base, layout: "ebook", bookPath: "javascript:alert(1)" })).toEqual(["bookId"]);
    expect(errors({ ...base, layout: "gallery", gallery: [] })).toEqual(["gallery"]);
  });

  it("accepts an extra button only with a label, a link, and a safe link", () => {
    expect(portalLinkUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(portalLinkUrl("/play")).toBe("/play");
    expect(portalLinkUrl("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    for (const bad of ["", "//evil.example", "javascript:alert(1)", "http://example.com", "play", "data:text/html,x", "https://a b.test"]) expect(portalLinkUrl(bad)).toBe("");
    expect(errors({ ...base, buttonLabel: "More games" })).toEqual(["buttonUrl"]);
    expect(errors({ ...base, buttonLabel: "More", buttonUrl: "javascript:alert(1)" })).toEqual(["buttonUrl"]);
    expect(errors({ ...base, buttonLabel: "More games", buttonUrl: "/play" })).toEqual([]);
  });

  it("keeps page addresses unique and well formed", () => {
    expect(errors({ ...base, id: "1", slug: "taken" }, [{ id: "2", slug: "taken" }])).toEqual(["slug"]);
    expect(errors({ ...base, id: "1", slug: "mine" }, [{ id: "1", slug: "mine" }, { id: "2", slug: "other" }])).toEqual([]);
    expect(errors({ ...base, slug: "Bad Slug!" })).toEqual(["slug"]);
  });
});

describe("what the gate says", () => {
  const states = ["loading", "verifying", "sent", "consent_sent", "needs_consent", "invalid_email", "consent_required", "expired", "used", "invalid", "not_subscribed", "rate_limited", "send_failed", "ended", "error"];

  it("has plain words for every situation: loading, success, bad email, expired link and errors", () => {
    for (const s of states) {
      const m = portalGateMessage(s, "me@example.test");
      expect(m.title.length).toBeGreaterThan(3);
      expect(m.text.length).toBeGreaterThan(10);
    }
    expect(portalGateMessage("sent", "me@example.test").text).toContain("me@example.test");
    expect(portalGateMessage("expired").text).toMatch(/30 minutes/);
  });

  it("announces problems assertively and progress politely", () => {
    for (const s of ["invalid_email", "expired", "used", "invalid", "not_subscribed", "rate_limited", "send_failed", "error", "consent_required"]) expect(portalGateMessage(s).tone).toBe("assertive");
    for (const s of ["loading", "verifying", "sent", "consent_sent", "needs_consent", "ended"]) expect(portalGateMessage(s).tone).toBe("polite");
  });

  it("maps server answers to those states, and anything unexpected to a general error", () => {
    for (const code of ["invalid_email", "expired", "used", "invalid", "not_subscribed", "rate_limited", "send_failed"]) expect(portalErrorState(code)).toBe(code);
    for (const code of ["server_error", "no_session", "", undefined, "<script>"]) expect(portalErrorState(code)).toBe("error");
  });

  it("checks an email before sending it", () => {
    expect(portalEmailOk(" me@example.test ")).toBe(true);
    for (const bad of ["", "me", "me@", "me@example", "me @example.test", "a@b@c.test"]) expect(portalEmailOk(bad)).toBe(false);
  });
});

describe("how the site wires the portal in", () => {
  it("has the archive at /newsletter and each entry at /newsletter/<address>", () => {
    expect(html).toContain('newsletter:"newsletter" };');
    expect(html).toContain('case "newsletter":        return viewNewsletter();');
    expect(html).toContain('case "newsletter-detail": return viewNewsletterEntry(p.id);');
  });

  it("checks the visitor before anything else, and shows only placeholder shapes until they are verified", () => {
    const index = body("viewNewsletter");
    expect(index.indexOf("portalKick()")).toBeGreaterThan(-1);
    expect(index).toContain("return portalDecoy();");
    // the real entries are only reachable inside the admin or ready branches
    expect(index.indexOf("return portalDecoy();")).toBeLessThan(index.indexOf("portalCard"));
    const decoy = body("portalDecoy");
    expect(decoy).not.toMatch(/E\(|PortalState|db\.list/);
    expect(decoy).toContain('aria-hidden="true"');
    const entry = body("viewNewsletterEntry");
    expect(entry.indexOf("return portalDecoy();")).toBeLessThan(entry.indexOf("PortalState.detail[slug]"));
  });

  it("never puts entries in the page for an unverified visitor: the list and entries come only from the portal function", () => {
    expect(html).toContain('portalCall("list", { session: P.session })');
    expect(html).toContain('portalCall("entry", { session: P.session, slug: slug })');
    expect(html).not.toMatch(/sb\.from\("portal_entries"\)/);
    expect(html).toContain('portalEntries: "portal_entries"');
  });

  it("builds the gate as a dialog that cannot be dismissed, with a way back to the public site", () => {
    const gate = body("portalGateHTML");
    expect(gate).toContain('role="dialog" aria-modal="true"');
    expect(gate).toContain("Join our mailing list");
    expect(gate).toContain("Back to the public website");
    expect(gate).toContain('type="email"');
    expect(gate).toContain('for="pg-email"');
    expect(gate).toContain('autocomplete="email"');
    expect(gate).not.toMatch(/close-modal|sheet-close|data-act="portal-close"/);
    const keys = body("portalGateKeys");
    expect(keys).toContain('ev.key === "Escape"');
    expect(keys).toContain("preventDefault()");
    const sync = body("portalSync");
    expect(sync).toContain("app.inert = true");
    expect(sync).toContain("preventScroll");
    expect(html).toContain("backdrop-filter:blur(26px)");
  });

  it("offers Try again when the members' corner cannot be reached, without losing a saved session", () => {
    expect(body("portalGateHTML")).toContain('data-act="portal-retry"');
    expect(html).toContain('"portal-retry": () => { PortalState.phase = "idle"; PortalState.gate.state = "idle"; rerender(); },');
    expect(body("portalBoot")).toContain('return portalSetGate({ state: "error", step: "email" });');
  });

  it("asks a newcomer for explicit consent before subscribing them", () => {
    const gate = body("portalGateHTML");
    expect(gate).toContain('name="consent"');
    expect(gate).toContain("I agree to receive occasional emails");
    expect(body("portalSubmit")).toContain('g.step === "consent" && !consent');
    expect(body("portalSubmit")).toContain("consent_required");
  });

  it("keeps a verified session in the browser and tidies the address after using a one-time link", () => {
    expect(html).toContain('const PORTAL_SESSION_KEY = "ccs_portal_session";');
    expect(body("portalScrub")).toContain('history.replaceState({}, "", location.pathname)');
    const boot = body("portalBoot");
    expect(boot.indexOf('portalCall("verify"')).toBeLessThan(boot.indexOf('portalCall("exchange"'));
    expect(boot.indexOf('portalCall("exchange"')).toBeLessThan(boot.indexOf('portalCall("session"'));
  });

  it("lets signed-in admins straight in, with a bar to manage entries", () => {
    expect(body("portalIsAdmin")).toContain("isAuthed() && isActiveAdmin()");
    expect(body("viewNewsletter")).toContain("const admin = portalIsAdmin();");
    expect(body("portalAdminBar")).toContain("#/admin/portalEntries");
    expect(body("portalSync")).toContain("!portalIsAdmin()");
  });

  it("shows a Word to know card below How to play, only when it has both the word and its meaning", () => {
    const card = body("portalWordHTML");
    expect(card).toContain("if (!word || !meaning) return");
    for (const f of ["vocabWord", "vocabSay", "vocabMeaning", "vocabExample"]) expect(card).toContain(f);
    expect(card).toContain('ic("book-open")');                              /* the book icon */
    expect(card).toContain('data-act="portal-say-word"');                  /* the Hear it button */
    expect(card).toContain('"speechSynthesis" in window');                 /* only where the browser can speak */
    const say = html.split('"portal-say-word": (el) => {')[1].split("\n  },")[0];
    expect(say).toContain("new SpeechSynthesisUtterance(word)");
    expect(say).toContain("x.localService");                                /* a voice on the device, not one fetched from a server */
    expect(say).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|new Audio/);  /* nothing is sent or downloaded */
    expect(html).toContain(".panel.pword{ margin:0 0 22px; padding:14px 18px 16px; background:#E3F3DC; }");   /* small and green */
    expect(card).toContain("E(word)");                                      /* text, never markup */
    expect(card).toContain("E(meaning)");
    const base = { title: "T", description: "d", category: "Updates", publishedAt: "2026-10-01", layout: "article", body: "x" };
    expect(portalValidate({ ...base, vocabWord: "gravity" }, []).some((v) => v.field === "vocabMeaning" && v.level === "error")).toBe(true);
    expect(portalValidate({ ...base, vocabWord: "gravity", vocabMeaning: "A pull." }, []).filter((v) => v.level === "error")).toEqual([]);
  });

  it("has a yellow Play button, and a How to play box under it when the entry has steps", () => {
    const game = body("portalGameHTML");
    expect(game).not.toContain("btn--cyan");
    expect(game.split("btn btn--sun btn--sm").length - 1).toBe(3);
    expect(game).toContain("Share with your friends</button>");
    expect(game).toContain("btn btn--paper btn--sm");                      /* the Share beside it, same size */
    expect(game).not.toContain("btn--lg");
    const how = body("portalHowToHTML");
    expect(how).toContain('if (!steps.length) return ""');
    expect(how).toContain("How to play");
    expect(how).toContain('class="panel panel--flat"');                     /* the same panel as a game's Play page */
    expect(how).toContain('<ol class="steps">');
    expect(how).toContain("E(x)");                                          /* steps are shown as text, never as markup */
    const page = body("portalEntryHTML");
    expect(page).toContain("media + portalHowToHTML(e) + portalWordHTML(e) + text");   /* the steps straight under the Play button, then the word card */
    expect(html.split("portalEntries: [")[1].split("\n  ],")[0]).toContain('key:"howToPlay"');
  });

  it("shows a game entry's cover in the same 16:9 shape as the picture on a game's Play page", () => {
    expect(body("portalGameHTML")).toContain("pmedia pmedia--cover pmedia--wide");
    expect(html).toContain(".pmedia--wide{ aspect-ratio:16/9; }");
    expect(html).toContain(".gameposter{\n  position:relative; overflow:hidden;\n  border:var(--line); border-radius:var(--r-lg); box-shadow:var(--hard);\n  aspect-ratio:16/9;");
    expect(html).toContain(".pprompt__note{ margin:14px 0 0; font-size:.95rem; font-weight:800;");
  });

  it("offers a copy-ready prompt box on any entry that has one, and nothing when it does not", () => {
    const box = body("portalPromptHTML");
    expect(box).toContain('if (!text) return ""');
    expect(box).toContain('data-act="portal-copy-prompt"');
    expect(box.split('data-act="portal-copy-prompt"').length - 1).toBe(1);   /* one Copy button... */
    expect(box.indexOf("pprompt__copy")).toBeLessThan(box.indexOf('id="pprompt-text"'));   /* ...in the corner of the box it copies from */
    /* ...with Open Gemini right beside it, in the same corner group, and nowhere else */
    const actions = box.slice(box.indexOf('class="pprompt__actions'), box.indexOf('id="pprompt-text"'));
    expect(actions).toContain('href="https://gemini.google.com/app"');
    expect(actions.indexOf("Copy prompt")).toBeLessThan(actions.indexOf("Open Gemini"));
    expect(box.split('Open Gemini</a>').length - 1).toBe(1);
    expect(box).toContain('href="https://gemini.google.com/app"');
    expect(box).toContain('rel="noopener noreferrer"');
    /* the grown-up message comes first, on every prompt box, before the steps */
    expect(box).toContain("Ask a grown-up first!");
    expect(box).toContain("not affiliated with, endorsed by, or sponsored by Google Gemini or any other AI platform");
    expect(box).toContain("any website that can collect information");
    expect(box).toContain('role="note"');
    expect(box.indexOf("pprompt__ask")).toBeLessThan(box.indexOf("pprompt__steps"));
    expect(box.indexOf("pprompt__ask")).toBeLessThan(box.indexOf("aiPromptTip"));
    expect(box).toContain("E(text)");                                       /* shown as text, never as markup */
    for (const icon of ["copy", "clipboard-paste", "sparkles"]) expect(box).toContain('ic("' + icon + '"');   /* the three picture steps */
    expect(box.split('class="pstep ').length - 1).toBe(3);
    expect(box).toContain("<ol class=\"pprompt__steps\">");                  /* still a real numbered list for screen readers */
    expect(box).toContain("E(String(e.aiPromptTip).trim())");               /* the creator tip too */
    expect(body("portalEntryHTML")).toContain("portalPromptHTML(e)");
    const copy = html.split('"portal-copy-prompt": async (el) => {')[1].split("\n  },")[0];
    expect(copy).toContain("navigator.clipboard.writeText(box.textContent)");
    expect(copy).toContain("Ctrl+C");                                       /* the fallback when the clipboard is blocked */
    expect(portalValidate({ title: "T", description: "d", category: "AI for kids", publishedAt: "2026-10-01", layout: "article", body: "x", aiPrompt: "a".repeat(1300) }, []).some((v) => v.field === "aiPrompt" && v.level === "warn")).toBe(true);
  });

  it("has one Share button on an entry: at the bottom, or next to Play on a game", () => {
    const page = body("portalEntryHTML");
    expect((page.match(/data-act="share"/g) || []).length).toBe(1);
    expect(page).toContain('(e.layout === "game" ? "" :');                  /* no second one at the bottom of a game */
    const game = body("portalGameHTML");
    expect(game).toContain('data-act="share"');
    expect(game).toContain("portalEntryUrl(location.origin, e)");           /* the plain address, never a private link */
    expect(game.split("btn + share").length - 1).toBe(2);                   /* beside Play, on the picture or in a row */
    expect(game.split("share + '</div>").length - 1).toBe(4);               /* poster, row, and the two on-the-page games */
    expect(game).toContain("hero(g ?");                                      /* even when the site game can't be found */
  });

  it("knows the archive also holds creative tips and AI lessons for kids", () => {
    expect(PORTAL_CATEGORIES).toEqual(expect.arrayContaining(["Creative tips", "AI for kids"]));
  });

  it("shares every entry by its plain address, in a button on the page", () => {
    const page = body("portalEntryHTML");
    expect(page).toContain('data-act="share"');
    expect(page).toContain("portalEntryUrl(location.origin, e)");
    expect(page).not.toMatch(/[?&]k=|\?v=/);
    expect((page.match(/data-act="share"/g) || []).length).toBeGreaterThanOrEqual(1);
  });

  it("has a layout for each content type", () => {
    const page = body("portalEntryHTML");
    for (const fn of ["portalVideoHTML", "portalGameHTML", "portalEbookHTML", "portalGalleryHTML"]) expect(page).toContain(fn + "(e)");
    expect(body("portalGameHTML")).toContain('data-act="portal-play"');
    expect(body("portalGameHTML")).toContain('sandbox="allow-scripts allow-same-origin allow-popups"');
    // ebooks here are interactive picture books, free to read in the site's own reader - not downloads
    expect(body("portalEbookHTML")).toContain("Open the book");
    expect(body("portalEbookHTML")).toContain('data-act="portal-play"');
    expect(body("portalEbookHTML")).not.toMatch(/download|Buy it|price/i);
    expect(html).not.toContain('accept:".pdf,.epub"');
    expect(body("portalGalleryHTML")).toContain('data-act="portal-photo"');
  });

  it("is in the admin portal: a manager, an Open the portal door, Publish / Unpublish and a layout switch", () => {
    expect(html).toContain('{ hash:"#/admin/portalEntries",  label:"Portal content"');
    expect(html).toContain('{ hash:"#/newsletter",           label:"Open the portal"');
    expect(html).toContain('"collections","mediaAssets","portalEntries"];');
    expect(html).toContain('data-act="portal-toggle"');
    expect(html).toContain('" Unpublish" : " Publish"');
    expect(html).toContain('type:"layoutpick"');
    expect(html).toContain('portalEntries: r => "#/newsletter/" + (r.slug || r.id)');
    expect(html).toContain('"portalEntries"];\nconst BACKED_COLLECTIONS');
  });

  it("has a simple editor: pick what you are sharing, fill in only what that needs, then Save draft or Publish", () => {
    const editor = body("openPortalEditor");
    expect(body("openEditor")).toContain('if (col === "portalEntries") return openPortalEditor(id);');
    expect(editor).toContain("More options");
    expect(editor).toContain('data-act="portal-save" data-status="draft"');
    expect(editor).toContain('data-act="portal-save" data-status="published"');
    expect(editor).toContain("Unpublish");
    expect(editor).not.toContain("Workflow status");
    const fields = html.split("  portalEntries: [")[1].split("  ],")[0];
    expect(fields.indexOf('key:"layout"')).toBeLessThan(fields.indexOf('key:"title"'));
    // the address, date and category are tucked away, not in the way
    for (const k of ["category", "publishedAt", "slug"]) {
      const line = fields.split("\n").find((l) => l.includes('key:"' + k + '"'));
      expect(line).toContain("more:true");
    }
    expect(html).toContain('"portal-pick-layout": (el) => {');
  });

  it("lists photos as rows with a picture and a description, not a pipe-separated box", () => {
    expect(body("portalPhotoRow")).toContain("Say what is in this photo");
    expect(html).toContain('type:"photos"');
    expect(html).toContain('data-act="portal-photos-add"');
  });

  it("keeps the portal's content, its emails and its subscribers together in one Newsletter section", () => {
    const nav = html.split("const ADMIN_NAV = [")[1].split("\n];")[0];
    const group = nav.split('{ heading:"Newsletter"')[1].split("{ heading:")[0];
    for (const label of ["Portal content", "Emails", "Subscribers", "Open the portal"]) expect(group).toContain('label:"' + label + '"');
    expect(nav.split('{ heading:"Operations"')[1].split("{ heading:")[0]).not.toMatch(/Newsletters|Subscribers|portalEntries/);
    // the three screens share one bar of links
    const tabs = body("newsletterTabs");
    for (const hash of ["#/admin/portalEntries", "#/admin/send-newsletter", "#/admin/subscribers", "#/newsletter"]) expect(tabs).toContain(hash);
    expect(html).toContain('body = newsletterTabs(section) + body;');
  });

  it("writes the portal content and its email in one form, and prepares the email when the entry is published", () => {
    const editor = body("openPortalEditor");
    expect(editor).toContain("The email that goes with it");
    expect(editor).toContain('fields.find(f => f.key === "email.on")');
    expect(editor).toContain("Nothing is sent until you say so.");
    const prep = body("portalPrepareEmail");
    expect(prep).toContain('?k=__ACCESS_KEY__');
    expect(prep).toContain('status: "draft"');           // a draft to review, never a send
    expect(prep).not.toContain('invoke("send-newsletter"');
    expect(prep).toContain('prior.status !== "draft"');  // a sent email is never rewritten
    expect(html).toContain('saved.status === "published" && await portalPrepareEmail(saved)');
    expect(html).toContain('{ id:"portal", label:"New in the Subscriber’s Portal"');
    // blank email boxes fall back to the entry itself
    expect(prep).toContain("entry.title");
    expect(prep).toContain("entry.description");
  });

  it("lets an entry carry an extra button and choose whether its text comes first", () => {
    expect(body("portalExtraButton")).toContain("portalLinkUrl(e.buttonUrl)");
    expect(body("portalEntryHTML")).toContain('e.textFirst === "before" ? text + media + portalHowToHTML(e) + portalWordHTML(e) : media + portalHowToHTML(e) + portalWordHTML(e) + text');
  });

  it("puts each subscriber's private key in newsletters", () => {
    expect(body("emailShell")).toContain("/newsletter?k=__ACCESS_KEY__");
    expect(html).toContain('data-act="nl-portal-link"');
    expect(html).toContain('"?k=__ACCESS_KEY__"');
  });

  it("is kept out of search engines", () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  });
});

describe("what the portal calls its readers", () => {
  it("labels the archive and the sign-in screen 'Subscribers only', not 'Members only'", () => {
    expect(html).not.toContain("Members only");
    expect(body("portalGateHTML")).toContain('<span class="eyebrow">Subscribers only</span>');
    expect(html).toContain('<span class="eyebrow">Subscribers only</span>\'\n    + \'<h1');
  });
});

describe("the Gravity 4 invitation on the home page", () => {
  const promo = body("gravityFourPromoHTML");
  const home = body("viewHome");

  it("invites people to join the mailing list and play, and says what else they get", () => {
    expect(promo).toContain("Subscribe and play");
    expect(promo).toContain('data-act="open-mailing-list"');                    /* the same sign-up as the nav and footer */
    expect(promo).toContain("Subscribers only content");
    expect(promo).toContain("<h2 id=\"g4-title\">Play Gravity <em>4</em> with Chike!</h2>");   /* the 4 is in italics */
    expect(promo).toContain("A 3D chip-dropping game made just for newsletter subscribers. Play against Chike, or challenge a friend online. Then make your own game with AI!");
    for (const perk of ["Exclusive content", "Free AI lessons for kids", "Downloadables", "Stories, videos and more"]) expect(promo).toContain(perk);
    expect(promo).toContain('href="#/newsletter"');                              /* people who already have a place in the archive */
    expect(promo).toContain("It’s free to subscribe! Unsubscribe at any time.</p>");
    expect(promo.indexOf("Kids, please ask a grown-up before you use AI.")).toBeGreaterThan(promo.indexOf("</picture>"));   /* the AI note sits under the picture */
  });

  it("keeps its two buttons big and equal, and its icon boxes centred", () => {
    const actions = promo.slice(promo.indexOf("g4promo__actions"), promo.indexOf("g4promo__fine"));
    expect(actions).not.toContain("btn--lg");
    expect(actions.split("btn--sm").length - 1).toBe(2);
    expect(html).toContain(".g4promo__actions{ display:flex; flex-wrap:nowrap;");   /* one row, even on a phone */
    expect(html).toContain("height:56px; min-height:56px;");                          /* the same height */
    /* the perk icon box out-ranks the plain text rule for the line under each perk, so it stays a centred grid */
    expect(html).toContain(".g4perks .g4perks__mark{");
    expect(html).toContain(".g4perks div span{");
  });

  it("uses the cover picture, holds still for people who ask for less motion, and never uses another company's game name", () => {
    expect(promo).toContain('srcset="assets/games/gravity-four.webp"');
    expect(promo).toContain("assets/games/gravity-four-loop.gif");
    expect(promo).toContain('loading="lazy"');
    expect(promo).not.toMatch(/connect[ -]?(four|4)\b/i);
    for (const f of ["../assets/games/gravity-four.webp", "../assets/games/gravity-four-loop.gif"]) expect(existsSync(new URL(f, import.meta.url))).toBe(true);
  });

  it("is a homepage module the admin can switch off, sitting right under the promise strip", () => {
    expect(home).toContain('if (on("gravityfour")) html += gravityFourPromoHTML();');
    expect(home.indexOf('on("strip")')).toBeLessThan(home.indexOf('on("gravityfour")'));
    expect(home.indexOf('on("gravityfour")')).toBeLessThan(home.indexOf('on("videos")'));
    const seed = body("seedHomepage");
    expect(seed).toContain('M("gravityfour","gravityfour"');
    expect(seed.indexOf('M("promise"')).toBeLessThan(seed.indexOf('M("gravityfour"'));
    expect(seed.indexOf('M("gravityfour"')).toBeLessThan(seed.indexOf('M("episodes"'));
  });
});

describe("the bar at the top of the portal pages", () => {
  it("says who is signed in, with no Sign out button", () => {
    const bar = body("portalMemberBar");
    expect(bar).toContain("Signed in");
    expect(bar).not.toContain("Sign out");
    expect(bar).not.toContain("portal-signout");
    expect(bar).not.toContain("<button");
  });
});
