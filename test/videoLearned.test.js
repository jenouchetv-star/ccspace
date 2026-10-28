// Every episode page has the green "What did they learn?" card: the educational discovery and the
// life lesson (the social-emotional theme) the team already writes for each episode. It is the same
// green card as "Word to know", and it only shows the halves that have been written.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("the What did they learn? card on an episode page", () => {
  it("shows the discovery and the life lesson, in plain words a child will see", () => {
    const f = body("videoLearnedHTML");
    expect(f).toContain("What did they learn?");
    expect(f).toContain("The discovery");
    expect(f).toContain("The life lesson");
    expect(f).toContain("v.learning");
    expect(f).toContain("v.moral");
    expect(f).toContain("E(text)");                                   // written by an editor, so always escaped
  });

  it("shows nothing when neither half has been written, and one column when only one has", () => {
    const f = body("videoLearnedHTML");
    expect(f).toContain('if (!learn && !moral) return "";');
    expect(f).toContain("plearn__cols--one");
  });

  it("sits on the episode page between the Like and share line and the cast", () => {
    const v = body("viewVideo");
    const at = v.indexOf("videoLearnedHTML(v)");
    expect(at).toBeGreaterThan(v.indexOf("Like, share, and subscribe"));
    expect(at).toBeLessThan(v.indexOf("Who is in it"));
  });

  it("wears the same green as the Word to know card, and stacks on a phone", () => {
    expect(html).toContain('class="panel panel--flat pword plearn"');
    expect(html).toContain(".plearn__cols{ display:grid; grid-template-columns:1fr 1fr;");
    expect(html).toContain("@media (max-width:640px){ .plearn__cols{ grid-template-columns:1fr; } }");
  });

  it("is edited in the admin episode editor, which says where each box shows up", () => {
    const videos = html.split("  videos: [")[1].split("  articles: [")[0];
    expect(videos).toContain('key:"learning", label:"Educational discovery"');
    expect(videos).toContain("The discovery");
    expect(videos).toContain('key:"moral", label:"Social-emotional theme"');
    expect(videos).toContain("The life lesson");
  });

  it("has both halves written for every episode that is published in the seed", () => {
    const seed = html.split("function seedVideos(){")[1].split("\nfunction ")[0];
    for (const m of seed.matchAll(/V\(\{ id:"([^"]+)"[\s\S]*?\}\),?/g)) {
      if (!/status:"published"/.test(m[0])) continue;
      expect(m[0], m[1] + " learning").toMatch(/learning:"[^"]{10,}"/);
      expect(m[0], m[1] + " moral").toMatch(/moral:"[^"]{10,}"/);
    }
  });
});
