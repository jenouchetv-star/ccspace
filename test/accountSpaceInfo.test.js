import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Owner: an info button and note on the Home "Account space" bar, each bar showing its own state, striped empty
   tracks, full in maroon (not red). Same change in Art Space and Sound Space. */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const APPS = [
  { name:"Art Space", file:"art-studio.html", noun:"pictures", Noun:"Pictures", from:"your gallery", warn:"#E8A020", warnRef:"#E8A020",
    usage: o => Object.assign({ ok:true, email:"parent@example.test", pictures:3, bytes:400000, maxPictures:200, maxBytes:100000000 }, o) },
  { name:"Sound Space", file:"sound-space.html", noun:"songs", Noun:"Songs", from:"Recent", warn:"#F2C14E", warnRef:"var[(]--winds[)]",
    usage: o => Object.assign({ ok:true, email:"parent@example.test", songs:3, bytes:400000, maxSongs:200, maxBytes:100000000 }, o) }
];

for (const app of APPS) {
  const html = readFileSync(new URL("../assets/apps/" + app.file, import.meta.url), "utf8");
  const m = /\/\*SPACE-INFO-START\*\/([\s\S]*?)\/\*SPACE-INFO-END\*\//.exec(html);
  const parts = m ? new Function("esc", m[1] + "\nreturn spaceParts;")(esc) : null;
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(x => x[1]).join("\n");
  const key = app.noun === "pictures" ? "pictures" : "songs", maxKey = app.noun === "pictures" ? "maxPictures" : "maxSongs";

  describe(app.name + ": account space info note", () => {
    it("builds the bar from a pure function", () => {
      expect(parts).toBeTypeOf("function");
    });

    it("has an (i) button right after the bold title, labelled and wired to the note", () => {
      const out = parts(app.usage(), false);
      expect(out.html).toMatch(/<b>Account space<\/b><button class="space__info" type="button" aria-label="What is account space\?" aria-expanded="false" aria-controls="space-info">/);
      expect(out.html).toContain('id="space-info" role="dialog" aria-label="About account space"');
    });

    it("shows the note only while open, and reflects it on the button", () => {
      const closed = parts(app.usage(), false).html, open = parts(app.usage(), true).html;
      expect(closed).toMatch(/id="space-info"[^>]*\shidden/);
      expect(open).not.toMatch(/id="space-info"[^>]*\shidden/);
      expect(open).toContain('aria-expanded="true"');
    });

    it("toggles on a press, closes on Escape or a click outside, and gives focus back", () => {
      expect(html).toMatch(/closest\("\.space__info"\)/);
      expect(html).toMatch(/e\.key === "Escape" && spaceOpen/);
      expect(html).toMatch(/function spaceSet\(open, back\)/);
      expect(html).toMatch(/if \(!open && back && b\) b\.focus\(\)/);
      expect(html).toMatch(/spaceOpen && !e\.target\.closest\("#space-info"\)/);
    });

    it("says what it is, with the " + app.noun + " wording", () => {
      const h = parts(app.usage(), true).html;
      expect(h).toContain("Saved to your account");
      expect(h).toContain("Your " + app.noun + " save as you go. Sign in with this email in any browser to open them.");
      expect(h).toContain("Running low? Delete " + app.noun + " you don't need.");
      expect(h).toContain("Nothing is ever deleted for you.");
      expect(h).toContain("The left bar: how many you've saved");
      expect(h).toContain("The right bar: how much room they take");
      expect(h).toContain(app.Noun + "</b>");
    });

    it("shows the member's own numbers, not fixed ones", () => {
      const h = parts(app.usage({ [key]:17, [maxKey]:500, bytes:12340000, maxBytes:250000000 }), true).html;
      expect(h).toContain("<b>17</b> of 500");
      expect(h).toContain("<b>12.3 MB</b> of 250 MB");
      expect(h).not.toContain("of 200");
      expect(h).not.toContain("of 100 MB");
    });

    it("each bar takes its own state: " + app.noun + " at 83% is warn, space at 41% stays normal", () => {
      const out = parts(app.usage({ [key]:166, bytes:41200000 }), false);
      expect(out.level).toBe("warn");
      const bars = [...out.html.matchAll(/<div class="space__bar"[^>]*><i([^>]*)><\/i>/g)].map(x => x[1]);
      expect(bars).toHaveLength(2);
      expect(bars[0]).toContain('class="lvl-warn"');
      expect(bars[0]).toContain("width:83.0%");
      expect(bars[1]).not.toMatch(/lvl-/);
      const meters = [...out.html.matchAll(/<div class="si-bar"><i([^>]*)>/g)].map(x => x[1]);
      expect(meters[0]).toContain("lvl-warn");
      expect(meters[1]).not.toMatch(/lvl-/);
    });

    it("full: only the full bar turns full, the heading and steps change, the overall level is full", () => {
      const out = parts(app.usage({ [key]:200, bytes:52700000 }), true);
      const h = out.html;
      expect(out.level).toBe("full");
      expect(h).toContain("<h3>Your account is full</h3>");
      expect(h).toContain("You can keep making " + app.noun + ". New ones save in this browser, so nothing is lost.");
      expect(h).toContain("<b>200</b> of 200 &middot; full");
      expect(h).toContain("<b>Delete " + app.noun + " you don't need</b> from " + app.from + " to make room.");
      expect(h).toContain("<b>save to your account by themselves.</b>");
      expect(h).toContain("Nothing is ever deleted for you.");
      expect(h).not.toContain("Running low?");
      expect(h).toContain("si--full");
      const bars = [...h.matchAll(/<div class="space__bar"[^>]*><i([^>]*)>/g)].map(x => x[1]);
      expect(bars[0]).toContain("lvl-full");
      expect(bars[1]).not.toMatch(/lvl-/);
    });

    it("a full space bar (not the count) also makes the account full", () => {
      const out = parts(app.usage({ bytes:100000000 }), true);
      expect(out.level).toBe("full");
      expect(out.html).toContain("<b>100.0 MB</b> of 100 MB &middot; full");
    });

    it("normal state has no level classes and the check hero", () => {
      const out = parts(app.usage(), true);
      expect(out.level).toBe("");
      expect(out.html).not.toMatch(/lvl-/);
      expect(out.html).not.toContain("si--full");
      expect(out.html).toContain('class="si-hero"');
    });

    it("escapes the email", () => {
      expect(parts(app.usage({ email:'<img src=x>' }), false).html).not.toContain("<img src=x>");
    });

    it("note is pure black with the draft border, shadow and arrow, full width on phones", () => {
      expect(css).toMatch(/\.si\{[^}]*background:#000;[^}]*border:1px solid #3A3A42/);
      expect(css).toMatch(/\.si\{[^}]*box-shadow:0 18px 40px rgba\(0,0,0,\.7\)/);
      expect(css).toMatch(/\.si::before\{/);
      expect(css).toMatch(/@media \(max-width:640px\)\{[^}]*\.si\{ left:0; width:100%; \}/);
    });

    it("the empty part of every bar is striped at 45 degrees, the fill stays solid; light theme gets a dark stripe", () => {
      expect(css).toContain("repeating-linear-gradient(45deg, rgba(255,255,255,.09) 0 2px, transparent 2px 6px)");
      expect(css).toContain("repeating-linear-gradient(45deg, rgba(0,0,0,.08) 0 2px, transparent 2px 6px)");
      expect(css).toMatch(/\.space__bar\{[^}]*height:8px/);
      expect(css).toMatch(/\.si-bar\{[^}]*height:8px/);
      expect(css).not.toMatch(/\.space__bar i\{[^}]*(animation|repeating)/);
    });

    it("full is maroon, not red, and warn is " + app.warn, () => {
      expect(css).toMatch(/\.space__bar i\.lvl-full\{[^}]*#A0185A/);
      expect(css).toMatch(/\.space__bar i\.lvl-warn\{[^}]*/);
      expect(css).toContain("rgba(160,24,90,");
      expect(css).toContain("#E46A9E");
      const full = css.split("\n").filter(l => /space--full|lvl-full/.test(l)).join("\n");
      expect(full).not.toMatch(/--danger|215,55,46|D7372E|FF6B6|D7263D/i);
      expect(css.toUpperCase()).toContain(app.warn.toUpperCase());
      expect(css).toMatch(new RegExp("lvl-warn\\{[^}]*" + app.warnRef, "i"));
    });

    it("no emojis, and no animated stripes", () => {
      expect(parts(app.usage(), true).html).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u);
      expect(css).not.toMatch(/@keyframes[^{]*stripe/i);
    });

    it("the toast for a full account uses the member's own limit, or no number", () => {
      expect(html).not.toMatch(/Your account has 200 (pictures|songs)/);
      expect(html).toMatch(/function fullToast\(\)/);
      expect(html).toContain("Your account has as many " + app.noun + " as it can keep. Delete some to save new ones there.");
      const f = /function fullToast\(\)\{([^\n]*)\}/.exec(html) || /function fullToast\(\)\{([\s\S]*?)\n\}/.exec(html);
      const run = lim => new Function("spaceMax", "return (function(){" + f[1] + "})()")(lim);
      expect(run(500)).toBe("Your account has 500 " + app.noun + ", the most it keeps. Delete some to save new ones there.");
      expect(run(0)).toBe("Your account has as many " + app.noun + " as it can keep. Delete some to save new ones there.");
    });
  });
}

describe("Sound Space: no orange, no green, no rainbow in the space bar", () => {
  const html = readFileSync(new URL("../assets/apps/sound-space.html", import.meta.url), "utf8");
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(x => x[1]).join("\n");
  it("warn uses gold, never amber", () => {
    const warn = css.split("\n").filter(l => /lvl-warn|space--warn/.test(l)).join("\n");
    expect(warn).toContain("var(--winds)");
    expect(warn.toUpperCase()).not.toContain("E8A020");
    expect(warn.toUpperCase()).not.toContain("C98A12");
  });
});
