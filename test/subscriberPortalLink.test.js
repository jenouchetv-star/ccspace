// The members-only archive is called the Subscriber’s Portal, and a subscriber who has signed in to it
// on this device sees a link to it in the top bar, right beside Join.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { chooseIntent } from "../assets/lib/copilot.js";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const nav = index.split("function navBar(isAdmin){")[1].split("\n}\n")[0];

describe("the Subscriber’s Portal link in the top bar", () => {
  it("sits right after Join, and points at the portal", () => {
    const join = nav.indexOf("' Join</button>'");
    const link = nav.indexOf('href="#/newsletter" aria-label="Subscriber’s Portal"');
    expect(join).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(join);
    expect(nav.slice(join, link)).not.toContain("DONATE_LINKS_ENABLED");   // nothing comes between Join and the link
  });
  it("shows only for someone signed in to the portal on this device", () => {
    expect(index).toContain('function portalIsSubscriber(){ return PortalState.phase === "ready" || !!portalSavedSession(); }');
    expect(nav).toContain("portalIsSubscriber() ?");
  });
  it("keeps the words on wide screens, shows just the icon on a phone, and is in the phone menu too", () => {
    expect(nav).toContain('<span class="nav__hide-sm"> Subscriber’s Portal</span>');
    const drawer = nav.split('class="nav__drawer-cta nav__only-sm"')[1].split("'</nav>'")[0];
    expect(drawer).toContain("Subscriber’s Portal</a>");
  });
});

describe("Sign in in the top bar (owner, 2026-11-24: people could not find a login)", () => {
  const signIn = index.split("function navSignInHTML(cls){")[1].split("\n}\n")[0];
  it("opens the Welcome back box, which emails a code, for the portal", () => {
    expect(signIn).toContain('data-act="open-mailing-list" data-member data-next="/newsletter"');
    expect(signIn).toContain("' Sign in</button>'");
  });
  it("is in the bar at every width, before Join, and in the phone menu beside Join, only for someone not signed in", () => {
    const bar = nav.indexOf('(portalIsSubscriber() ? "" : navSignInHTML(" nav__signin"))');
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeLessThan(nav.indexOf("' Join</button>'"));
    const drawer = nav.split('class="nav__drawer-cta nav__only-sm"')[1].split("'</nav>'")[0];
    expect(drawer.indexOf('navSignInHTML(" nav__drawer-signin")')).toBeGreaterThan(drawer.indexOf("Join our mailing list"));
  });
  it("opens the portal once the code is right", () => {
    const send = index.split('if (act === "newsletter-submit"){')[1].split("\n  }\n")[0];
    expect(send).toContain("newsletterCodeHTML(email, game, member && !!back)");
    const box = index.split("function newsletterCodeHTML(")[1].split("\n}\n")[0];
    expect(box).toContain(`(game || go ? '<input type="hidden" name="go" value="1">' : "")`);
    expect(index.split('if (act === "newsletter-code"){')[1].split("\n  }\n")[0]).toContain('if (form.elements["go"]) navigate("#" + (r.next || "/newsletter"));');
  });
});

describe("the grown-up tick box on the mailing-list forms", () => {
  it("is one shared box with plain wording, required, and not pre-ticked", () => {
    const box = index.split("function adultCheckHTML(id){")[1].split("\n}\n")[0];
    expect(box).toContain('name="adult" required>');
    expect(box).not.toContain("checked");
    expect(box).toContain("I confirm that I am a parent, guardian or educator aged 18 or over.</span>");
    expect(box).not.toContain("my own email address");
  });
  it("is on all three forms: the popup, the footer and the Articles join box", () => {
    for (const id of ["ml-adult", "news-adult", "art-adult"]) expect(index).toContain('adultCheckHTML("' + id + '")');
    expect(index.split('data-act="newsletter-submit"').length - 1).toBe(3);
  });
  it("is checked again when the form is sent, before anything is saved or emailed", () => {
    const send = index.split('if (act === "newsletter-submit"){')[1].split("\n  }\n")[0];
    expect(send).toContain('const adult = form.elements["adult"];');
    expect(send.indexOf("adult.checked")).toBeLessThan(send.indexOf("newsletterGate(form)"));
    expect(send.indexOf("adult.checked")).toBeLessThan(send.indexOf('portalCall("request"'));
  });
  it("is also part of the consent line on the portal's own sign-in gate", () => {
    expect(index).toContain("I confirm that I am a parent, guardian or educator aged 18 or over, I agree to receive occasional emails");
  });
});

describe("the new name", () => {
  it("replaces Newsletter Archive on the page, in the portal's own messages and in the emails", () => {
    const portalJs = readFileSync(new URL("../assets/lib/portal.js", import.meta.url), "utf8");
    const portalFn = readFileSync(new URL("../supabase/functions/portal/index.ts", import.meta.url), "utf8");
    for (const src of [index, portalJs, portalFn]) {
      expect(src).toContain("Subscriber’s Portal");
      expect(src).not.toMatch(/Newsletter Archive/i);
    }
  });
  it("is understood by the Copilot, as well as the old names", () => {
    for (const say of ["Add this to the Subscriber’s Portal", "put it in the subscribers portal", "Add this to the newsletter archive"]) {
      expect(chooseIntent(say + " https://youtu.be/dQw4w9WgXcQ", "", []).kind).toBe("portal");
    }
  });
});
