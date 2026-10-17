// The site plays its games and reads its picture books inside an <iframe> on
// its own origin. A response header of X-Frame-Options: DENY blocks that (the
// browser says "refused to connect"), which is exactly what broke every game
// on the launched site. SAMEORIGIN allows our own pages to frame our own
// games while still refusing every other website. This pins that.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const headers = readFileSync(new URL("../_headers", import.meta.url), "utf8");
const code = headers.split(/\r?\n/).filter((l) => !l.trim().startsWith("#")).join("\n");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("_headers framing policy", () => {
  it("applies to every path and uses SAMEORIGIN, never DENY", () => {
    expect(code).toMatch(/^\/\*\s*$/m);
    expect(code).toMatch(/^\s*X-Frame-Options:\s*SAMEORIGIN\s*$/m);
    expect(code).not.toMatch(/X-Frame-Options:\s*DENY/i);
  });

  it("does not allow other sites to frame this one (no wildcard frame-ancestors, no ALLOW-FROM)", () => {
    expect(code).not.toMatch(/frame-ancestors[^;\n]*\*/i);
    expect(code).not.toMatch(/ALLOW-FROM/i);
  });

  it("the app really does frame its own games in a same-origin iframe (the reason DENY is wrong)", () => {
    expect(html).toMatch(/<iframe id="gamestage-frame" src="' \+ E\(g\.path\)/);
  });
});
