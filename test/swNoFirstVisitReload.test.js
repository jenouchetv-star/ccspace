// The page never reloads itself on a first visit (owner, 2026-11-16: "the old content/page is loading first before
// the new content appears"). A brand-new service worker takes control with clients.claim(), which fires
// "controllerchange"; reloading on that drew every first visit twice. The page now reloads only when this tab
// asked for the new version (the Refresh button on the update banner).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = site.split('if ("serviceWorker" in navigator && location.protocol !== "file:"){')[1].split("</script>")[0];

describe("the update reload", () => {
  it("reloads only after this tab pressed Refresh", () => {
    const handler = block.split('addEventListener("controllerchange"')[1].split("});")[0];
    expect(handler).toContain("if (reloaded || !refreshAsked) return;");
  });
  it("both Refresh paths mark that this tab asked for the new version", () => {
    expect(block.match(/refreshAsked = true;/g) || []).toHaveLength(2);
  });
});
