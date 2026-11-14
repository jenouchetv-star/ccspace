import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const line = html.split("\n").find(l => l.trim().startsWith("const latest = list.slice(0, 1)"));
/* the Latest line, run on a list (newest first) and the Top story ids */
const latestOf = (list, topIds, hasSide = true) => new Function("list", "topIds", "hasSide", line + "\nreturn latest;")(list, topIds, hasSide);

describe("News & Articles: Latest", () => {
  const list = ["new", "a", "top1", "b", "top2", "c", "d"].map(id => ({ id }));
  it("starts with the newest article, even when it is also a top story", () => {
    expect(latestOf(list, ["new", "top1", "top2"]).map(a => a.id)).toEqual(["new", "a", "b", "c"]);
  });
  it("otherwise skips top stories, so the banner is not repeated", () => {
    expect(latestOf(list, ["top1", "top2"]).map(a => a.id)).toEqual(["new", "a", "b", "c"]);
    expect(latestOf(list, ["top1", "top2"], false).map(a => a.id)).toEqual(["new", "a", "b"]);
  });
  it("leaves out of More articles anything already shown in Top stories, Latest or Editor's choice", () => {
    expect(html).toContain("const shownIds = topIds.concat(latest.map(a => a.id), editorsPicks.map(a => a.id));");
    expect(html).toContain("const more = list.filter(a => shownIds.indexOf(a.id) < 0);");
  });
});
