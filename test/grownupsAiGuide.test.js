import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

/* guideAiHTML() with the page's helpers swapped for small stand-ins: slot() and slotText() read SLOTS, db.find() reads ARTS */
function render(arts, slots){
  const SLOTS = Object.assign({
    aiTitle: "Creating with AI", aiText: "Our guideline.", aiAsksLabel: "Before they press send, ask",
    aiAsks: "Did you try it yourself first?\n\nAre you asking for a hint?", aiArticleId: "art-kids-ai-guide", aiButton: "Read our guide for parents",
    aiStage1Badge: "Under 6", aiStage1Title: "Not yet", aiStage1Text: "Hands-on play first.",
    aiStage2Badge: "6 to 12", aiStage2Title: "Together, every time", aiStage2Text: "Sit side by side.",
    aiStage3Badge: "13 and up", aiStage3Title: "Guided independence", aiStage3Text: "Set the rules together."
  }, slots || {});
  const fn = new Function("slot", "slotText", "db", "ic", "E", "articleFigureHTML",
    "function guideAiHTML(" + body("guideAiHTML") + "\nreturn guideAiHTML;");
  return fn(
    (g, k) => "<slot:" + k + ">" + SLOTS[k],
    (g, k) => SLOTS[k] || "",
    { find: (col, id) => (col === "articles" ? arts.find(a => a.id === id) : null) || null },
    name => "<i:" + name + ">",
    s => String(s),
    f => "<figure:" + f.type + ":" + f.title + ">"
  )();
}
const article = { id: "art-kids-ai-guide", status: "published", charts: [
  { type: "stats", title: "Our age guide at a glance" },
  { type: "table", title: "Nine habits for using AI at home", columns: ["Do this"], rows: [["Sit side by side"]] }
] };

describe("the Parent & Teacher Guide", () => {
  it("has no Try this card, and no See an example button that jumped to it", () => {
    expect(html).not.toContain("function guideTryHTML(");
    expect(html).not.toContain('data-target="guide-try"');
    for (const k of ["tryEyebrow", "tryId", "tryPhoto", "tryButton", "exampleButton"]) expect(html).not.toContain('{ key:"' + k + '"');
    expect(html).not.toContain(".guide__try");
  });
  it("shows the While they make tips in one card, as columns rather than separate cards", () => {
    expect(html).toContain(`+ '<div class="panel guide__tips"><div class="grid tips-grid">'`);
    expect(html).toContain(`quEditable("grownup-tip", grownupsId0, '<div class="guide__tip">'`);
    expect(html).toContain(".guide__tips .tips-grid > *{");
  });
  it("keeps the tape on top of the home and class photos, which fill their box and would otherwise cover it", () => {
    expect(html).toContain(".guide__photo::before{ z-index:1; }");
  });
});

describe("the Parent & Teacher Guide's Creating with AI section", () => {
  it("shows the guideline, the questions, the three ages, the article's habits table and a button to the article", () => {
    const out = render([article]);
    expect(out).toContain("<slot:aiTitle>Creating with AI");
    expect(out).toContain("<slot:aiText>Our guideline.");
    expect(out).toContain("<li><i:message-circle><span>Did you try it yourself first?</span></li>");
    expect(out.match(/<li>/g).length).toBe(2);   // blank lines are skipped
    for (const k of ["aiStage1Badge", "aiStage2Title", "aiStage3Text"]) expect(out).toContain("<slot:" + k + ">");
    expect(out).toContain('<span class="chip chip--ink"><slot:aiStage2Badge>6 to 12</span>');   // badges are black
    expect(out).toContain("<figure:table:Nine habits for using AI at home>");   // read from the article, never copied
    expect(out).not.toContain("<figure:stats");
    expect(out).toContain('<a class="btn btn--cyan" href="#/article/art-kids-ai-guide"><i:book-open> <slot:aiButton>');   // the CTA is blue
  });
  it("leaves out the table and the button while the article is a draft or missing, but keeps the guideline", () => {
    for (const arts of [[], [Object.assign({}, article, { status: "draft" })]]){
      const out = render(arts);
      expect(out).toContain("<slot:aiText>");
      expect(out).not.toContain("<figure:");
      expect(out).not.toContain("btn--cyan");
    }
  });
  it("sits between Turn a story into a starting point and While they make, on tan and with no outline on the age cards", () => {
    const page = html.slice(html.indexOf('slot(G, "storyWatch")'), html.indexOf('quEditable("grownups-tips-heading"'));
    expect(page).toContain("+ guideAiHTML()");
    expect(html).toContain(".panel.guide__story.guide__ai{ background:var(--paper); }");
    expect(html).toContain(".guide__aistage{ background:none; border:0; padding:0; }");   // the ages sit right on the tan
    expect(html).toContain('{ key:"aiArticleId", section:"Creating with AI"');
  });
});
