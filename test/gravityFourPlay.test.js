// Chike's Gravity 4 is on the Play page, but only subscribers can play it: the card has a lock, and its page
// sends everyone to the game's Subscriber's Portal entry, where the portal's own gate signs people up (email,
// consent, confirm link) before the game's code is ever handed out. The code never becomes a site file.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/gravity-four-play.sql", import.meta.url), "utf8");
const fn = (name) => index.split("function " + name + "(")[1].split("\n}\n")[0];

describe("Gravity 4 on the Play page", () => {
  it("is a games row of its own kind, pointing at the portal entry, with no game file", () => {
    const seed = index.split('G({ id:"game-gravity-four"')[1].split("}),")[0];
    expect(seed).toContain('kind:"members"');
    expect(seed).toContain('portalSlug:"chikes-gravity-four"');
    expect(seed).toContain('path:""');
    expect(seed).toContain("interactive:true");
    expect(sql).toContain("insert into games (id, data) values ('game-gravity-four'");
    expect(sql).toContain('"kind":"members","portalSlug":"chikes-gravity-four","path":""');
    const statements = sql.split("\n").filter((l) => !l.startsWith("--")).join("\n");
    expect(statements).not.toMatch(/portal_game_files|gameHtml|<html/i); // the code stays in the locked table
  });
  it("shows a Subscribers only lock on its card", () => {
    expect(fn("gameCard")).toContain('g.kind === "members" ? \'<span class="card__badge chip chip--members">\' + ic("lock") + \' Subscribers only</span>\'');
    expect(index).toContain(".chip--members{");
  });
  it("never plays the game on its own page: a subscriber goes to the portal entry", () => {
    const p = fn("membersPoster");
    expect(p).toContain('const to = "#/newsletter/" + slug;');
    expect(p).toContain("portalIsSubscriber()");
    expect(p).not.toContain("open-game");
    expect(p).not.toContain("srcdoc");
    expect(fn("viewGame")).toContain('if (g.kind === "members"){');
  });
  it("sits its buttons low on the picture, under Chike's face, side by side (stacked on a phone, on a taller picture)", () => {
    expect(fn("membersPoster")).toContain('<div class="gameposter gameposter--low"');
    expect(index).toContain(".gameposter--low{ place-items:end center; }");
    expect(index).toContain(".gameposter--low{ aspect-ratio:4/3; }");
  });
  it("has Join free to play for someone new, and its own button for someone already subscribed", () => {
    const p = fn("membersPoster");
    expect(p).toContain('data-act="open-mailing-list" data-next="/newsletter/\' + E(slug) + \'" data-game="\' + E(g.title) + \'">\' + ic("lock") + \' Join free to play</button>');
    expect(p).toContain('data-act="open-mailing-list" data-member data-next="/newsletter/\' + E(slug) + \'" data-game="\' + E(g.title) + \'">\' + ic("log-in") + \' Already joined? Sign in</button>');
  });
  it("opens the Join modal in the matching words: Play Chike's Gravity 4 to join, Welcome back! to get a code", () => {
    const modal = fn("mailingListModal");
    expect(modal).toContain("const play = back && game ? String(game) : \"\";");
    expect(modal).toContain("const back2 = !!member;");
    expect(modal).toContain("? '<h3 style=\"margin:.2em 0 .3em;font-size:1.6rem\">Join our mailing list</h3>'");
    expect(modal).not.toContain(">Play ' + nameHTML(play)");
    expect(modal).toContain("Join our free mailing list to play. We’ll email you a 6-digit code to confirm.");
    expect(modal).toContain(">Welcome back!</h3>");
    expect(modal).toContain("Enter the email you subscribed with and we’ll send you a 6-digit code to ");
    expect(modal).toContain("(play ? 'play ' + nameHTML(play) + '.' : 'sign in to the Subscriber’s Portal.')");
    expect(modal).toContain("(back2 ? ' Send my code' : ' Join')");
    expect(modal).toContain("(play ? '<input type=\"hidden\" name=\"code\" value=\"1\"><input type=\"hidden\" name=\"game\" value=\"' + E(play) + '\">' : \"\")");   // both ask for a code
    expect(modal).toContain('1789240884060-Gemini_Generated_Image_tri3mjtri3mjtri3.jpg" alt="Chike, Zech, and their 6 uniquely creative friends"');              // the whole crew, for a game
    expect(index).toContain('game || member ? "modal--narrow" : ""');          // and a smaller box
    expect(index).toContain(".modal--narrow{ width:min(520px,100%); }");
    expect(modal).toContain('(back2 ? "" : adultCheckHTML("ml-adult"))');   // the tick box is for joining, not for "Welcome back"
    expect(modal).toContain('(back2 ? \'<input type="hidden" name="member" value="1">\' : "")');
    expect(index).toContain('openModal(mailingListModal(el && el.getAttribute("data-next"), game, member), null, game || member ? "modal--narrow" : "");');
  });
  it("brings people back to the game after they confirm their email", () => {
    const modal = fn("mailingListModal");
    expect(modal).toContain('<input type="hidden" name="next" value="');
    expect(modal).toContain("/^\\/newsletter(\\/[a-z0-9][a-z0-9-]{0,80})?$/i");   // the same rule the portal function uses
    const send = index.split('if (act === "newsletter-submit"){')[1].split("\n  }\n")[0];
    expect(send).toContain('next: back || "/newsletter"');
    expect(index).toContain('data-act="open-mailing-list" data-next="/newsletter/\' + E(slug) + \'" data-game="\' + E(g.title) + \'">\' + ic("lock") + \' Join free to play');   // the game's own page
    expect(fn("portalNextPath")).toContain('"/newsletter/" + encodeURIComponent(r.params.id)');
  });
  it("can be set up from the admin games form, which insists on the portal game", () => {
    expect(index).toContain('{value:"members",label:"Subscribers only (plays in the Subscriber’s Portal)"}');
    expect(index).toContain('{ key:"portalSlug", label:"Subscriber’s Portal game", type:"select"');
    expect(index).toContain('if (r.kind === "members" && isBlank(r.portalSlug)) err("portalSlug"');
  });
  it("has a cover and a small copy for the card, and stays out of the sitemap like the rest of the members' content", () => {
    expect(existsSync(new URL("../assets/games/gravity-four.jpg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../assets/games/gravity-four-thumb.jpg", import.meta.url))).toBe(true);
    expect(readFileSync(new URL("../sitemap.xml", import.meta.url), "utf8")).not.toContain("gravity-four");
    const gen = readFileSync(new URL("../supabase/generate-sitemap.mjs", import.meta.url), "utf8");
    expect(gen).toContain('skip: r => r.kind === "members"');               // the hourly sitemap job leaves it out too
    expect(gen).toContain("!(d.skip && d.skip(r))");
  });
});

describe("Pathbuilder's How to play", () => {
  it("no longer says players take turns", () => {
    const seed = index.split('G({ id:"game-pathbuilder"')[1].split("}),")[0];
    expect(seed).not.toContain("take turns");
    expect(seed).not.toContain("Randomize my deck");
    expect(seed).toContain("You both build at the same time");
    expect(sql).toContain("where id = 'game-pathbuilder'");
  });
});

describe("the code box after Send my link", () => {
  it("asks for the 6-digit code from the email, the same box for subscribers and newcomers", () => {
    const box = fn("newsletterCodeHTML");
    expect(box).toContain("We sent a 6-digit code to");
    expect(box).toContain('autocomplete="one-time-code"');
    expect(box).toContain('data-act="newsletter-code"');
    expect(box).toContain("Verify and play");
    const send = index.split('if (act === "newsletter-submit"){')[1].split("\n  }\n")[0];
    expect(send).toContain("code: true");
    expect(send).toContain('openModal(newsletterCodeHTML(email, game), null, "modal--narrow");');
  });
  it("checks the code with the portal, keeps the session, and opens the game", () => {
    const check = index.split('if (act === "newsletter-code"){')[1].split("\n  }\n")[0];
    expect(check).toContain('portalCall("verify_code", { email: email, code: code })');
    expect(check).toContain("portalSaveSession(r.session);");
    expect(check).toContain('navigate("#" + (r.next || "/newsletter"));');
    expect(index).toContain("too_many_tries:");
  });
  it("adds the wrong-guess counter to the tokens table, in the standalone file and for a fresh project", () => {
    const line = "alter table portal_tokens add column if not exists tries int not null default 0;";
    for (const f of ["portal-codes.sql", "newsletter-portal.sql", "migration.sql"]) {
      expect(readFileSync(new URL("../supabase/" + f, import.meta.url), "utf8")).toContain(line);
    }
  });
});

describe("Welcome back (Already joined? Sign in)", () => {
  it("is offered under every Join form: the nav box, the footer and the Articles box", () => {
    expect(index).toContain('+ (back2 ? "" : signInLinkHTML(back, play));');
    expect(index.split('signInLinkHTML("", ""').length - 1).toBe(2);   // the footer, and the Articles box (laid out beside its form)
    expect(fn("signInLinkHTML")).toContain("Already joined?</b>");
  });
  const send = index.split('if (act === "newsletter-submit"){')[1].split("\n  }\n")[0];
  it("does not ask a subscriber to tick the grown-up box again", () => {
    expect(send).toContain('if (!member && (!adult || !adult.checked))');
  });
  it("asks only for a code, with no consent, so nobody new is ever added from it", () => {
    expect(send).toContain("? { email: email, code: true, next: back || \"/newsletter\" }");
  });
  it("turns into the Join version, email filled in, for an address that is not on the list", () => {
    expect(send).toContain('if (member && sent.status === "needs_consent"){');
    expect(send).toContain('openModal(mailingListModal(back, game, false), null, "modal--narrow");');
    expect(send).toContain("That email is not on our mailing list yet.");
  });
});
