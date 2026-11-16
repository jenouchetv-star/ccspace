// About pages (owner, 2026-11-16): every About banner is the gradient band. About Us is the opening one, like the
// Parent & Teacher Guide; the tabs after it have a small photo like the Online and Offline Games banners. Our Mission
// and Our Vision keep a short banner and the rest of the text continues below, beside a photo.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const branch = (sub, next) => site.split('sub === "' + sub + '"){')[1].split(next)[0];

describe("About banners", () => {
  it("About Us opens with the gradient banner", () => {
    expect(branch("team", 'else if (sub === "business"){')).toContain("fill: true, gradient: true");
  });
  it("Mission, Vision, What we believe and Business Inquiries use the gradient band", () => {
    for (const [sub, next] of [["mission", 'else if (sub === "beliefs"){'], ["beliefs", 'else if (sub === "vision"){'], ["vision", 'const confidenceText'], ["business", "const businessLedeLead"]]) {
      expect(branch(sub, next)).toMatch(/gradient: true/);
    }
  });
  it("Mission, Vision and What we believe have a small banner photo", () => {
    for (const [sub, next] of [["mission", 'else if (sub === "beliefs"){'], ["beliefs", 'else if (sub === "vision"){'], ["vision", 'const confidenceText']]) {
      expect(branch(sub, next)).toContain("asideSmall: true");
    }
    expect(branch("beliefs", 'else if (sub === "vision"){')).toContain("assets/grownups/in-class-stem.jpg");
  });
});

describe("Mission and Vision continue below the banner", () => {
  const mission = branch("mission", 'else if (sub === "beliefs"){');
  it("keeps only the first paragraph of the mission in the banner", () => {
    expect(mission).toContain('extra: copyPara("mission-extra-1", missionId, missionExtra1),');
    expect(mission.split("head = cmsHeader")[1].split("body =")[0]).not.toContain("mission-extra-2");
  });
  it("puts the closing line as a pull quote and a photo beside the rest of the mission", () => {
    expect(mission).toContain('aboutStory("From watching to creating."');
    expect(mission).toContain('<blockquote class="aboutstory__quote">');
    expect(mission).toContain("assets/about/teacher-reading-with-student.jpg");
  });
  it("moves the longer vision below the banner, beside a photo", () => {
    const vision = site.split('sub === "vision"){')[1].split('else if (sub === "partners")')[0];
    expect(vision).toContain('aboutStory("Creativity is the first step toward something bigger."');
    expect(vision).toContain("assets/grownups/at-home.jpg");
    expect(vision.split("head = cmsHeader")[1].split("});")[0]).not.toContain("vision-extra");
  });
});
