// Body copy (a page's paragraphs, section blurbs, tips, FAQ answers, bios, card text) can be formatted by an admin -
// new paragraphs, bold, italic, underline, lists and links - from Quick Update and from the admin portal's page form,
// while text that was never formatted shows exactly as it always has.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("formatting body copy", () => {
  it("has a smaller toolbar for paragraphs: no headings or pictures", () => {
    const tools = html.split("const COPY_TOOLS = [")[1].split("];")[0];
    for (const cmd of ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList", "createLink", "unlink", "removeFormat"]) expect(tools).toContain('cmd:"' + cmd + '"');
    expect(tools).not.toContain("formatBlock");
    expect(tools).not.toContain("insertImage");
  });

  it("keeps plain text plain, and turns each new line into a paragraph", () => {
    expect(html).toContain("function normalizeCopy(html){");
    expect(html).toContain('.replace(/<div(\\s[^>]*)?>/gi, "<p>").replace(/<\\/div>/gi, "</p>")');
    expect(html).toContain('return s.split(/\\n+/).map(p => p.trim()).filter(Boolean).map(p => "<p>" + E(p) + "</p>").join("");');
    expect(html).toContain("function copyHTML(v){ const s = String(v == null ? \"\" : v); return copyIsHTML(s) ? sanitizeHTML(s) : E(s); }");
  });

  it("lets Quick Update format every page paragraph", () => {
    for (const r of ["mission-extra-1", "mission-extra-2", "mission-extra-3", "vision-extra", "vision-confidence-text", "vision-confidence-note",
      "team-working-text", "home-arcade-text", "home-arcade-note", "create-finder-lede", "newsletter-note", "donate-strip-text", "grownups-contact-lede"]){
      expect(html).toMatch(new RegExp('"' + r + '":\\s*\\{[^}]*contentType:"text", copy:true'));
      expect(html).toContain('copyPara("' + r + '"');
    }
    expect(html).toContain('copyEditorControl("value", currentValue ||');
    expect(html).toContain('const copied = region.copy ? readCopyField(form, "value") : null;');
  });

  it("lets list text be formatted too: section blurbs, steps, cards, bios, tips, FAQ answers", () => {
    expect(html).toContain('{ key:"lede", label:"Lede", type:"copy" }');
    expect(html).toContain('{ key:"bio", label:"Bio", type:"copy" },');
    expect(html).toContain('{ key:"answer", label:"Answer", type:"copy" }],');
    expect(html).toContain('copyText(sec.lede, { cls:"lede" })');
    expect(html).toContain('copyText(t.text, { cls:"tiny mute", style:"margin:0" })');
    expect(html).toContain('value[f.key] = f.type === "copy" ? (readCopyField(form, f.key) || "")');
  });

  it("shows each page's own paragraphs in the admin page form, and only on that page", () => {
    expect(html).toContain('{ key:"extra2", label:"Paragraph 2", type:"richtext", copy:true, wide:true, pages:["about/mission"]');
    expect(html).toContain("(FIELDS[col] || []).filter(f => !f.pages || f.pages.indexOf(rec.key) >= 0).map(f => fieldControl(f, rec))");
    expect(html).toContain("if (!area && f.pages) return;");
  });

  it("shows formatting readably when a change is reviewed", () => {
    expect(html).toContain("return copyIsHTML(v) ? quReadableCopy(v) : String(v);");
    expect(html).toContain('.replace(/<(strong|b)>([\\s\\S]*?)<\\/\\1>/gi, "**$2**")');
  });
});
