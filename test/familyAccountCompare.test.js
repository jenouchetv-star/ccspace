// Open to everyone vs a free family account, on the Family account page (owner, 2026-11-27: "build it";
// draft docs/mockups/family-account-compare-draft.png).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const members = html.split('else if (sub === "members"){')[1].split("\n  else {")[0];

describe("the family account comparison", () => {
  it("sits at the top of the Family account page, before the story", () => {
    expect(members).toContain("body = compare + '<section class=\"aboutstory\">");
    expect(members).toContain('<section class="famcmp" aria-labelledby="famcmp-h">');
  });

  it("counts what is published, so the numbers stay true", () => {
    expect(members).toContain('const pub = (t) => db.list(t).filter(r => r.status === "published");');
    expect(members).toContain('plural(nOpenActs, "activity", "activities") + " to make"');
    expect(members).toContain('nOnline + " to play online and " + nOffline + " to play offline"');
    expect(members).toContain('plural(memGames.length, "more game", "more games")');
  });

  it("says the account stays free and the Studio is free during beta, and every word is a page slot", () => {
    expect(html).toContain('{ key:"famSub", section:"Open to everyone vs family account", label:"Right card: under the title", fb:"Free, and it stays free" }');
    expect(html).toContain('{ key:"famBeta", section:"Open to everyone vs family account", label:"Right: the Studio\'s tag", fb:"Free during beta" }');
    expect(members).toContain('cmpLi("palette", "Creative Space Studio", slot(M, "famStudio"), slot(M, "famBeta"))');
  });

  it("has two cards of one height, stacked on a phone, with Join free (or the portal for a family already in)", () => {
    expect(html).toContain(".famcmp__grid{ display:grid; grid-template-columns:1fr 1fr; gap:28px; align-items:stretch; }");
    expect(html).toContain("@media (max-width:820px){ .famcmp__grid{ grid-template-columns:1fr; }");
    expect(members).toContain("(member ? '<a class=\"btn btn--cyan\" href=\"#/newsletter\">' + ic(\"door-open\") + ' ' + slot(M, \"portalButton\") + '</a>' : join)");
  });
});
