// New versions arrive without asking (owner, 2026-11-28: no "A new version is ready" box, the site refreshes itself), at
// the next page change only, and never on a first visit (owner, 2026-11-16: a first visit's worker taking control drew
// the page twice).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const site = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const block = site.split('if ("serviceWorker" in navigator && location.protocol !== "file:"){')[1].split("</script>")[0];
const fn = (name) => site.split("function " + name + "(")[1].split("\nfunction ")[0];

describe("a new version, without asking", () => {
  it("has no update box any more", () => {
    expect(site).not.toContain("showUpdateBanner");
    expect(site).not.toContain("A new version is ready</h3>");
    expect(site).not.toContain("#sw-update-banner");
  });

  it("a waiting build is only noted; it never reloads the page by itself", () => {
    expect(block).toContain("if (reg.waiting && navigator.serviceWorker.controller) SW_WAITING = reg.waiting;");
    expect(block).toContain('if (fresh.state === "installed" && navigator.serviceWorker.controller) SW_WAITING = fresh;');
    expect(block).not.toContain("location.reload()");
  });

  it("the new build takes over only when this tab switched to it, then the next page loads on it", () => {
    const handler = block.split('addEventListener("controllerchange"')[1].split("});")[0];
    expect(handler).toContain("if (SW_SWITCHING) SW_SWITCHING();");
    const next = fn("swUpdateOnNextPage");
    expect(next).toContain('w.postMessage("SKIP_WAITING")');
    expect(next).toContain("location.assign(url)");
    expect(next).toContain("setTimeout(go, 2500)");
  });

  it("switches on the next page change and on Back or Forward", () => {
    const go = site.split("  go(target){")[1].split("\n  },")[0];
    expect(go.indexOf("if (swUpdateOnNextPage(url)) return;")).toBeLessThan(go.indexOf("history.pushState({}, \"\", url);"));
    const pop = site.split('window.addEventListener("popstate", () => {')[1].split("});")[0];
    expect(pop).toContain("if (swUpdateOnNextPage(location.pathname + location.search + location.hash)) return;");
  });

  it("waits on the admin and in the Studio, where unsaved work lives in the page", () => {
    const hold = new Function("SITE_BASE", "return function swHoldUpdateOn(" + fn("swHoldUpdateOn") + ";")("/");
    expect(hold("/admin")).toBe(true);
    expect(hold("/admin/newsletters")).toBe(true);
    expect(hold("/create/studio/art")).toBe(true);
    expect(hold("/create/studio")).toBe(true);
    expect(hold("/play/online")).toBe(false);
    expect(hold("/create")).toBe(false);
    expect(hold("/administrator-tips")).toBe(false);
  });
});
