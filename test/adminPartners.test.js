import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fnBody = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("admin: program partners", () => {
  it("lists Program partners under the Business group and routes it (the old maker-demo link too)", () => {
    const nav = html.split("const ADMIN_NAV = [")[1].split("\n];")[0];
    const group = nav.split('{ heading:"Business"')[1].split("{ heading:")[0];
    expect(group).toContain('hash:"#/admin/partners"');
    expect(group).toContain('label:"Program partners"');
    expect(group).not.toContain("maker-demo");
    expect(html).toContain('else if (section === "partners" || section === "maker-demo") body = adminPartners();');
  });

  it("is a partner manager, not a frame around the demo, and opens the demo in a new tab", () => {
    const body = fnBody("adminPartners");
    expect(body).not.toContain("<iframe");
    expect(body).toContain('href="assets/apps/maker-demo.html" target="_blank"');
    expect(body).toContain("Present the demo");
    expect(body).toContain("Sample data");
    expect(body).toContain("Needs attention");
    expect(html).not.toContain("function adminMakerDemo(");
  });

  it("has one stage tab per partnership stage plus All, and every sample partner sits on a known stage", () => {
    const stages = html.split("const PARTNER_STAGES = ")[1].split(";\n")[0];
    for (const s of ["Inquiry", "Intro call", "Plan chosen", "Agreement sent", "Onboarding", "Active"]) expect(stages).toContain('"' + s + '"');
    const sample = html.split("const PARTNERS_SAMPLE = [")[1].split("\n];")[0];
    const keys = [...sample.matchAll(/st:"(\w+)"/g)].map((m) => m[1]);
    expect(keys.length).toBe(10);
    for (const k of keys) expect(["inq", "call", "plan", "agr", "onb", "act"]).toContain(k);
    expect(sample).not.toMatch(/@(?!\w+\.example")/);
  });

  it("turns off all caps everywhere in the admin", () => {
    expect(html).toContain(".admin-shell, .admin-shell *, #modal-root .admin-scope, #modal-root .admin-scope *{ text-transform:none !important; }");
  });
});
