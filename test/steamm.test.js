// About > What we believe (its own page since 2026-11-16, after Our Vision) says what we believe: early childhood development through STEAMM (Science, Technology,
// Engineering, Art, Math, and Music), how that differs from STEM, why we believe in it, and our principles.
// Drafts: docs/mockups/steamm-mission-draft.png, docs/mockups/what-we-believe-draft.png
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const nav = site.split("const ABOUT_NAV = [")[1].split("];")[0];

describe("the What we believe page", () => {
  it("comes right after Our Vision in the About menu, and Our Partners is last", () => {
    const subs = [...nav.matchAll(/sub:"([a-z]+)"/g)].map(m => m[1]);
    expect(subs.indexOf("beliefs")).toBe(subs.indexOf("vision") + 1);
    expect(subs[subs.length - 1]).toBe("partners");
    expect(nav).toContain('{ hash:"#/about/beliefs",  sub:"beliefs",  label:"What we believe" }');
  });
  it("holds the STEAMM section, then the beliefs list", () => {
    expect(site).toContain("body = steammPanel() + beliefsPanel();");
  });
  it("is no longer on the Mission page", () => {
    expect(site).toContain("body = frameworkCards();");
    expect(site).not.toContain("body = steammPanel() + frameworkCards();");
  });
  it("is listed in the sitemap and the footer site map", () => {
    expect(site).toContain('leaf("/about/beliefs", "What we believe")');
    expect(readFileSync(new URL("../sitemap.xml", import.meta.url), "utf8")).toContain("/about/beliefs</loc>");
  });
});

describe("the STEAMM section", () => {
  it("names all six subjects, music included", () => {
    expect(site).toContain("we believe in early childhood development through STEAMM: Science, Technology, Engineering, Art, Math, and Music.");
    for (const word of ["Science", "Technology", "Engineering", "Art", "Math", "Music"]) expect(site).toContain('["' + word.charAt(0) + '","' + word + '"');
  });
  it("says how STEAMM is different from STEM, and why we believe in it", () => {
    expect(site).toContain("How STEAMM is different from STEM");
    expect(site).toContain("STEAMM keeps all four and adds art and music");
    expect(site).toContain("Why we believe in it");
  });
  it("lists our STEAMM principles", () => {
    expect(site).toContain("Our STEAMM principles");
    for (const p of ["Make something real.", "Mix the subjects.", "Try, learn and try again."]) expect(site).toContain(p);
  });
});
