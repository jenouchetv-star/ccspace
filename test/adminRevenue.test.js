import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const between = (a, b) => html.split(a)[1].split(b)[0];
const css = JSON.parse(between("const REV_CSS = ", ";\nconst REV_HTML"));
const markup = JSON.parse(between("const REV_HTML = ", ";\nconst REV = "));
const boot = between("function revBoot(sr){", "\n/* Admin > Program partners");

describe("admin: revenue", () => {
  it("sits under Business next to Program partners and has its own route", () => {
    const nav = between("const ADMIN_NAV = [", "\n];");
    const group = nav.split('{ heading:"Business"')[1].split("{ heading:")[0];
    expect(group).toContain('hash:"#/admin/revenue"');
    expect(group).toContain('label:"Revenue"');
    expect(group).toContain('label:"Program partners"');
    expect(html).toContain('else if (section === "revenue") body = adminRevenue();');
    expect(html).toContain("  mountAdminRevenue();\n");
  });

  it("is drawn in a shadow root, so its styles never meet the site's, and keeps its state across re-renders", () => {
    expect(between("function mountAdminRevenue(){", "\n}")).toContain("attachShadow({ mode:'open' })");
    expect(boot).toContain("REV.S = S; REV.tab = tab; REV.filter = filter;");
    expect(boot).toContain("if (REV.booted){");
    expect(boot).not.toContain("document.body");
    expect(boot).not.toContain("document.addEventListener(");
  });

  it("is sample and test data only: nothing goes to the database", () => {
    expect(boot).not.toMatch(/\bsb\.|\bdb\.(save|insert|update|remove)|fetch\(/);
    expect(markup).toContain("Sample data");
    expect(boot).toContain("localStorage.setItem(TEST_KEY");
    expect(boot).toMatch(/try \{ localStorage\.setItem\(TEST_KEY[^}]*\} catch/);
  });

  it("has the period picker, the calendar, the donuts, needs attention, the tabs and the test data sliders", () => {
    for (const t of ["Weekly", "Monthly", "School year", "Pick dates", "Where it comes from", "Where it goes", "School year plan", "Needs attention and coming up", "Test data"]) expect(markup).toContain(t);
    for (const k of ["starter", "plus", "full", "libAnnual", "libPer", "kids", "donMonthly", "donOnce", "sponsors", "memMonthly", "memYearly"]) expect(boot).toContain("['" + k + "',");
    expect(boot).toContain('type="range"');
  });

  it("follows the house rules: no all caps, mono semi-bold money, calm motion that respects reduced motion", () => {
    expect(css).not.toMatch(/text-transform:\s*uppercase/);
    expect(css).toMatch(/\.m\{ font-family:'Roboto Mono',monospace; font-weight:600;/);
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
    expect(css).toContain("cubic-bezier(.2,.8,.2,1)");
    expect(css + markup).not.toMatch(/—/);
  });
});
