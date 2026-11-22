// A Digital Activity can be an app on this site (Write with Yuna, owner 2026-11-22: an activity, not a game). Its
// page is laid out like a Subscriber's Portal game (Air Harp), not the step-by-step activity page.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fn = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];
const activityAppPath = new Function("return " + "function activityAppPath(" + fn("activityAppPath").split("\n")[0])();

describe("a Digital Activity that is an app", () => {
  it("only opens a page in games/ on this site", () => {
    expect(activityAppPath({ appPath: "games/write-with-yuna.html" })).toBe("games/write-with-yuna.html");
    for (const bad of ["https://evil.example/x.html", "/games/write-with-yuna.html", "games/../index.html", "games/x.html?a=1", "supabase/private-games/x.html", "javascript:alert(1)", ""])
      expect(activityAppPath({ appPath: bad }), bad).toBe("");
    expect(activityAppPath({})).toBe("");
    expect(activityAppPath(null)).toBe("");
  });
  it("has the Air Harp layout: the picture with its button on it, How to use it, the word to know, what you will learn", () => {
    expect(fn("viewActivity")).toContain("if (activityAppPath(a)) return activityAppHTML(a);");
    const page = fn("activityAppHTML");
    expect(page).toContain('<div class="pposter"><figure class="pmedia pmedia--cover pmedia--wide">');
    expect(page).toContain('data-act="open-activity-app" data-id="');
    expect(page).toContain("Share with your friends");
    expect(page).toContain("How to use it");
    expect(page).toContain("portalWordHTML({ vocabWord: a.vocabWord");
    expect(page).toContain("portalSections(sanitizeHTML(a.body))");
    expect(page).toContain('<a href="#/create/tech">');            // it stays a free Digital Activity, not the portal
    expect(page).not.toContain("stepsHTML(");                       // no step-by-step "How to make it"
    expect(page).not.toContain('data-act="print"');
  });
  it("opens the app in the game stage, so the picked grade and the answers work", () => {
    expect(html).toContain('if (path) openGameStage({ id: "activity-" + a.id, title: a.title, path: path, icon: "pencil", sharePath: "/activity/" + a.id });');
  });
  it("has its picture and its word in Heart's voice", () => {
    for (const f of ["assets/activities/write-with-yuna/main.jpg", "assets/activities/write-with-yuna/main-thumb.jpg", "assets/words/stroke.mp3"])
      expect(existsSync(new URL("../" + f, import.meta.url)), f).toBe(true);
  });
});
