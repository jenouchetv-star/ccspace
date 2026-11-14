import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../assets/apps/art-studio.html", import.meta.url), "utf8");
const body = (name) => "function " + name + "(" + html.split("function " + name + "(")[1].split("\nfunction ")[0];
const { fileSize, sizeText } = new Function(body("fileSize") + "\n" + body("sizeText") + "\nreturn { fileSize, sizeText };")();

describe("Art Space: file sizes in the picture gallery", () => {
  it("writes sizes the way people read them", () => {
    expect(sizeText(0)).toBe("");
    expect(sizeText(999)).toBe("1 KB");
    expect(sizeText(48_200)).toBe("48 KB");
    expect(sizeText(1_250_000)).toBe("1.3 MB");
  });
  it("measures the picture's own data, not its small gallery picture", () => {
    const p = { id: "a", title: "Tiger", layers: [{ id: "l1", strokes: [] }] };
    const withThumb = Object.assign({ thumb: "data:image/png;base64," + "A".repeat(200000) }, p);
    expect(fileSize(withThumb)).toBe(fileSize(p));
  });
  it("shows the size next to the date under each picture's name", () => {
    expect(html).toContain("esc([when(p.updated), fileSize(p)].filter(Boolean).join(\" · \"))");
  });
});
