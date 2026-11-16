// About > Our Mission says what we believe: early childhood development through STEAMM (Science, Technology,
// Engineering, Art, Math, and Music), how that differs from STEM, why we believe in it, and our principles.
// Draft the owner approved: docs/mockups/steamm-mission-draft.png
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("the STEAMM section on the Mission page", () => {
  it("is part of the Mission page, above the step cards", () => {
    expect(site).toContain("body = steammPanel() + frameworkCards();");
  });
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
