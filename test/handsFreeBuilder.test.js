// Hands-Free Builder on a phone: the digital hand panel stays a slim strip, so the building table keeps the screen.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// read with plain line endings, however git checked the file out (Windows checkouts get \r\n)
const html = readFileSync(new URL("../supabase/private-games/hands-free-builder.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const phone = html.split("@media (max-width:540px){")[1].split("\n  }\n")[0];

describe("the building table", () => {
  it("puts the color blocks on a shelf under the build, not on the right, whenever that makes the build bigger", () => {
    const layout = html.split("function layoutStage(){")[1].split("\n  }\n")[0];
    expect(layout).toContain("Math.min(r.width / 11, r.height / 14.5) >= Math.min(r.width / 17, r.height / 10)");
    const shape = html.split("function setShape(tall){")[1].split("\n  }\n")[0];
    expect(shape).toContain("RX0 = tall ? 0.5 : 11");          // the shelf spans the width under the build
    const pack = html.split("function packShelf(list){")[1].split("\n  }\n")[0];
    expect(pack).toContain("b.hy = SF - base - b.h");          // rows stand on the shelf floor
    expect(pack).toContain("SF = TALL ? GY + 0.95 + total : GY");
  });
  it("sends a block let go over the shelf back to the shelf", () => {
    const plan = html.split("function dropPlan(b, r){")[1].split("\n  }\n")[0];
    // the drop is given only the block's corner, so its height comes from the block itself
    expect(plan).toContain("if (TALL && (r.y - L.oy) / L.U + b.h / 2 > GY + 0.4) return { tray:true };");
    expect(plan).not.toContain("r.h");
  });
});

describe("the digital hand on a phone", () => {
  it("tells the page which way the player is building (camera, mouse or not yet)", () => {
    const show = html.split("function showGesture(g){")[1].split("\n  }\n")[0];
    expect(show).toContain('document.documentElement.setAttribute("data-mode", state.mode)');
  });
  it("hides the hand picture unless the camera is on, leaving just the status and the camera button", () => {
    expect(phone).toContain(':root:not([data-mode="camera"]) .cam canvas{ display:none; }');
  });
  it("keeps the hand picture small beside the status when the camera is on", () => {
    expect(phone).toMatch(/\.cam canvas\{[^}]*width:\d{2}px/);
    expect(phone).toContain(".cam .panel-head{ display:none; }");
  });
});
