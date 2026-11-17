// Our Vision shows the Create > Discover > Learn > Grow > Share steps as a loop (owner, 2026-11-17: "Move the diagram in
// mission to the vision page but make it smaller or around looping graph since the process is a continuous process").
// Draft: docs/mockups/vision-loop-draft.jpg
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fn = (name) => "function " + name + "(" + site.split("function " + name + "(")[1].split("\n}\n")[0] + "\n}";
const vision = site.split('else if (sub === "vision"){')[1].split('else if (sub === "team"){')[0];
const mission = site.split('if (sub === "mission"){')[1].split('else if (sub === "steamm"){')[0];

describe("the loop on Our Vision", () => {
  it("draws the Mission page's five steps around a circle, the last one leading back to the first", () => {
    const f = fn("visionLoop");
    expect(f).toContain('pageListItems("about/mission", "framework")');
    expect(f).toContain('quEditable("mission-step", missionId');
    expect(f).toContain("for (let i = 0; i < n; i++)");
    expect(f).toContain("ang(i + 1)");
    expect(f).toContain('<b>Reimagine</b>');
    expect(f).toContain("Each new skill or tool sparks the next idea");
    expect(f).toContain('aria-label="');
  });
  it("sits in the self-esteem panel in place of the Imagine > Make > Learn > Grow row", () => {
    expect(vision).toContain("'<div class=\"confidence__chain\">' + visionLoop() + '</div>'");
    expect(vision).not.toContain('<ol class="chain">');
    expect(site).not.toContain('field:"chain"');
  });
  it("is smaller than the panel and scales down on phones", () => {
    expect(site).toContain(".loop{ position:relative; width:min(340px,100%); aspect-ratio:1;");
  });
});

describe("Our Mission", () => {
  it("no longer has the five step cards", () => {
    expect(mission).not.toContain("frameworkCards()");
    expect(site).not.toContain("function frameworkCards(");
  });
});
