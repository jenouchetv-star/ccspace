// About > What we believe (its own page since 2026-11-16, after Our Vision) says what we believe: early childhood development through STEAMM (Science, Technology,
// Engineering, Art, Math, and Music), how that differs from STEM, why we believe in it, and our principles.
// Drafts: docs/mockups/steamm-mission-draft.png, docs/mockups/what-we-believe-draft.png
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const nav = site.split("const ABOUT_NAV = [")[1].split("];")[0];

describe("the What we believe page", () => {
  it("comes right after Our Vision in the About menu", () => {
    const subs = [...nav.matchAll(/sub:"([a-z]+)"/g)].map(m => m[1]);
    expect(subs.indexOf("steamm")).toBe(subs.indexOf("vision") + 1);
    expect(nav).toContain('{ hash:"#/about/steamm",   sub:"steamm",   label:"STEAMM Methodology" }');
  });
  it("holds the STEAMM section, then the beliefs list", () => {
    expect(site).toContain("body = steammPanel() + beliefsPanel();");
  });
  it("is no longer on the Mission page", () => {
    expect(site).toContain("      + frameworkCards();");
    expect(site).not.toContain("body = steammPanel() + frameworkCards();");
  });
  it("is listed in the sitemap and the footer site map", () => {
    expect(site).toContain('leaf("/about/steamm", "STEAMM Methodology")');
    expect(readFileSync(new URL("../sitemap.xml", import.meta.url), "utf8")).toContain("/about/steamm</loc>");
  });
});

describe("the STEAMM section", () => {
  it("names all six subjects, music included", () => {
    expect(site).toContain("we empower K–5 learners through <b>STEAMM (Science, Technology, Engineering, Art, Math, and Music)</b> during the most formative bridge in a child’s education.");
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

describe("how creativity grows problem solvers", () => {
  it("sits in the STEAMM section, above the principles", () => {
    const panel = site.split("function steammPanel(){")[1].split("\n}\n")[0];
    expect(panel.indexOf("How creativity grows problem solvers")).toBeGreaterThan(-1);
    expect(panel.indexOf("How creativity grows problem solvers")).toBeLessThan(panel.indexOf("Our STEAMM principles"));
  });
  it("covers problem solving, new approaches, feedback, criticism and building on ideas", () => {
    for (const t of ["Creative problem solving", "Open to new approaches", "Using feedback", "Handling criticism", "Building on each other"]) expect(site).toContain(t);
    expect(site).toContain("one opinion about their work is not a verdict on them");
  });
  it("can be edited like the rest of the STEAMM section", () => {
    expect(site).toContain('{ field:"growHabits", label:"How creativity grows problem solvers"');
    expect(site).toContain('pageVal("about/mission", "steammGrow"');
  });
});

describe("the calmer What we believe layout (owner, 2026-11-16)", () => {
  const panel = site.split("function steammPanel(){")[1].split("\n}\n")[0];
  const beliefs = site.split("function beliefsPanel(){")[1].split("\n}\n")[0];
  it("keeps the six STEAMM tiles, with no colors, each with its own drawn icon", () => {
    expect(panel).toContain('class="believe__tiles"');
    expect(panel).not.toMatch(/background:#/);
    for (const k of ["Science", "Technology", "Engineering", "Art", "Math", "Music"]) expect(site).toMatch(new RegExp("STEAMM_ICONS[\\s\\S]*?" + k + ":\\s*'<svg"));
  });
  it("drops the colored cards and check marks from the STEAMM sections and the beliefs", () => {
    expect(panel).not.toContain("panel--flat");
    expect(panel).not.toContain('ic("check")');
  });
  it("breaks the sections up with photos of kids making things, each described", () => {
    for (const src of ["assets/grownups/rubber-band-guitar.jpg", "assets/activities/cardboard-house.jpg", "assets/grownups/while-they-make-birdhouse.jpg"]) {
      expect(panel + beliefs).toContain(src);
    }
    expect((panel + beliefs).match(/believePhoto\("assets\/[^"]+\.jpg", "[^"]{20,}"\)/g).length).toBe(3);
    expect(panel + beliefs).not.toContain('alt=""');
  });
  it("gives every section room to breathe", () => {
    expect(site).toMatch(/\.believe__sec\{[^}]*padding:\s*\d{2}px 0/);
  });
});

describe("the creativity photos (owner, 2026-11-16)", () => {
  const panel = site.split("function steammPanel(){")[1].split("\n}\n")[0];
  it("puts the cardboard house on the right of the intro and the guitar on the left of the other four habits", () => {
    const head = panel.indexOf('id="growHead"'), first = panel.indexOf("habitsHTML.slice(0, 1)"), house = panel.indexOf('believePhoto("assets/activities/cardboard-house.jpg"');
    const guitar = panel.indexOf('believePhoto("assets/grownups/rubber-band-guitar.jpg"'), rest = panel.indexOf("habitsHTML.slice(1)");
    expect(head).toBeGreaterThan(-1);
    expect(house).toBeGreaterThan(first);
    expect(guitar).toBeGreaterThan(house);
    expect(guitar).toBeLessThan(rest);
  });
});

describe("the STEAMM heading (owner, 2026-11-16)", () => {
  it("asks What is STEAMM?", () => {
    expect(site).toContain('<h2 id="steammHead">What is <span class="hl">STEAMM</span>?</h2>');
  });
});

describe("What we believe lines up with the banner (owner, 2026-11-16)", () => {
  it("uses the page's own width, like the banner, instead of a narrower cap", () => {
    expect(site).not.toMatch(/\.believe\{[^}]*max-width/);
  });
});

describe("learning from other people's creative process, backed by research (owner, 2026-11-16)", () => {
  it("says children grow as thinkers by seeing how others create", () => {
    expect(site).toContain('pageVal("about/mission", "steammOthers"');
    expect(site).toContain("they add a new move to their own toolbox");
  });
  it("cites three real studies, each with a link to the paper", () => {
    const block = site.split("const STEAMM_RESEARCH = [")[1].split("];")[0];
    for (const doi of ["10.1080/10400410409534549", "10.1016/0010-0285(80)90013-4", "10.1016/j.tics.2015.08.005"]) expect(block).toContain("https://doi.org/" + doi);
    expect(block).toContain("70 studies");
    expect(site).toContain('<h2 id="researchHead">What the research says</h2>');
  });
});

describe("Open to new approaches sits above Using feedback (owner, 2026-11-16)", () => {
  it("keeps only the first habit beside the cardboard house, the other four beside the guitar", () => {
    expect(site).toContain('habitsHTML.slice(0, 1).join("")');
    expect(site).toContain('habitsHTML.slice(1).join("")');
  });
});

describe("containers and check marks (owner, 2026-11-16)", () => {
  const panel = site.split("function steammPanel(){")[1].split("\n}\n")[0];
  const beliefs = site.split("function beliefsPanel(){")[1].split("\n}\n")[0];
  it("puts How creativity grows problem solvers inside a container", () => {
    expect(panel).toContain('<section class="believe__sec" aria-labelledby="growHead"><div class="panel believe__box">');
  });
  it("puts What we believe inside a container, with a check mark on every belief", () => {
    expect(beliefs).toContain('<div class="panel believe__box">');
    expect(beliefs).toContain('ic("check")');
  });
});

describe("taped photos (owner, 2026-11-16)", () => {
  it("gives every What we believe photo the site's yellow tape", () => {
    const fn = site.split("function believePhoto(src, alt){")[1].split("\n}\n")[0];
    expect(fn).toContain('class="believe__photo taped"');
  });
});

describe("the STEAMM line is bold (owner, 2026-11-16)", () => {
  it("bolds STEAMM and its six subjects in the opening line", () => {
    expect(site).toContain("we empower K–5 learners through <b>STEAMM (Science, Technology, Engineering, Art, Math, and Music)</b> during the most formative bridge in a child’s education.");
  });
});

describe("the What we believe banner reads clearly (owner, 2026-11-16)", () => {
  it("opens with a plain sentence about what we believe, then says what the page covers", () => {
    expect(site).toContain('"We believe children learn best when they actively create, whether engineering a physical project or designing and problem solving in the digital space. Here we outline our foundation in STEAMM education, how creative thinking turns children into confident problem solvers, and the commitments we uphold for the families who join us."');
    expect(site).not.toContain("The ideas that shape everything we make: how children learn");
  });
});

describe("the page is called STEAMM Methodology (owner, 2026-11-16)", () => {
  it("is headed Our STEAMM methodology, at /about/steamm", () => {
    expect(site).toContain(`head = cmsHeader("about/steamm", "About", 'Our STEAMM <span class="hl">methodology</span>.'`);
  });
  it("still opens from the old What we believe address", () => {
    expect(site).toContain('if (sub === "beliefs") sub = "steamm";');
  });
});

describe("the What is STEAMM opening names K-5 (owner, 2026-11-16)", () => {
  it("says why the K-5 years are the right time", () => {
    expect(site).toContain("Spanning ages 5 to 11, these elementary years mark the leap from playful curiosity to structured problem-solving");
  });
});
