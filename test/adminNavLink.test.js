// A signed-in admin who is browsing the public site sees an "Admin" link in the top navigation.
// The public nav is only drawn on public pages, so the link must depend on the session, not on the current route.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const nav = index.split("function navBar(isAdmin){")[1].split("\n}\n")[0];

describe("the Admin link in the public navigation", () => {
  it("points at the portal and has an accessible name", () => {
    expect(nav).toContain('<a class="btn btn--sm btn--ink" href="#/admin" aria-label="Admin portal">');
  });

  it("shows only for a signed-in, active (second-factor) admin", () => {
    const at = nav.indexOf('href="#/admin"');
    const gate = nav.slice(nav.lastIndexOf("(isAuthed()", at), at);
    expect(gate).toContain("isAuthed() && isActiveAdmin()");
  });

  it("does not depend on the route flag, which is always false where this nav is drawn", () => {
    const at = nav.indexOf('href="#/admin"');
    const gate = nav.slice(nav.lastIndexOf("+ (", at), at);
    expect(gate).not.toContain("isAdmin &&");
    expect(index).toContain('const ownHeader = AppState.route.name === "admin";');
  });

  it("keeps the word on wide screens and shows just the icon on a phone", () => {
    expect(nav).toContain('<span class="nav__hide-sm"> Admin</span>');
  });
});
