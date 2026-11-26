// "A new version is ready" is a box in the middle of the page (owner, 2026-11-25), not a bar across the top.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fn = html.split("function showUpdateBanner(")[1].split("\nfunction ")[0];

describe("the new-version box", () => {
  it("is a dialog in the middle of the page, in the Who's creating look", () => {
    expect(fn).toContain('box.className = "who swup";');
    expect(fn).toContain('box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");');
    expect(fn).toContain("A new version is ready</h3>");
    expect(fn).toContain("Refresh now</button>");
    expect(fn).toContain(">Later</button>");
    expect(html).toContain("#sw-update-banner{ z-index:1300; }");
    expect(html).not.toMatch(/#sw-update-banner\{\s*position:fixed; top:0;/);           // no bar across the top
  });
  it("Refresh now refreshes; Later, Escape or a tap outside closes it; the keyboard stays inside", () => {
    expect(fn).toContain('$("#sw-update-refresh").addEventListener("click", onRefresh);');
    expect(fn).toContain('$("#sw-update-dismiss").addEventListener("click", close);');
    expect(fn).toContain("if (ev.target === box) close();");
    expect(fn).toContain('if (ev.key === "Escape")');
    expect(fn).toContain('if (ev.key === "Tab")');
    expect(fn).toContain('$("#sw-update-refresh").focus();');
  });
  it("its buttons, like every CTA, stay round with the keyboard on them (it opens with Refresh now focused)", () => {
    expect(html).toContain(".btn:focus-visible{ border-radius:var(--r-pill); }");
    expect(html).toContain(".btn--icon:focus-visible{ border-radius:12px; }");
    expect(html.indexOf(".btn:focus-visible{ border-radius:var(--r-pill); }")).toBeGreaterThan(html.indexOf(":focus-visible{\n  outline:4px solid var(--cyan);"));
  });
  it("no bouncy entrance, no em dashes", () => {
    const css = html.split("#sw-update-banner{ z-index:1300; }")[1].split("/* ====")[0];
    expect(css).not.toContain("cubic-bezier");
    expect(fn + css).not.toContain("—");
  });
});

describe("the new-version box, without its icon (owner, 2026-11-25)", () => {
  it("opens straight on the title", () => {
    expect(fn).not.toContain("swup__icon");
    expect(fn).not.toContain('ic("sparkles")');
    expect(html).not.toContain(".swup__icon");
    expect(fn).toContain("'<div class=\"who__card swup__card\">'\n    + '<h3 id=\"sw-update-title\">");
  });
});

describe("the new-version box's words (owner, 2026-11-25)", () => {
  it("says what the change may bring", () => {
    expect(fn).toContain('<p id="sw-update-text">This change may include a new game, book, and site update.</p>');
  });
});
