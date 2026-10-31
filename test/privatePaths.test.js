// Cloudflare Pages serves every file in the repository (.assetsignore is a Workers file that Pages does not
// read), so the project's working files were public: supabase/ with the members-only Gravity 4 code, the
// tests, internal notes, CI settings. A Pages Function takes priority over a static file at the same address,
// so each private path has a catch-all Function that answers 404. This keeps every top-level folder and
// file either knowingly public or blocked, so a new private folder cannot slip out unnoticed.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const topFolders = [...new Set(tracked.filter((f) => f.includes("/")).map((f) => f.split("/")[0]))];
const topFiles = tracked.filter((f) => !f.includes("/"));

// what the site itself serves
const PUBLIC_FOLDERS = ["assets", "games", "books"];
const PUBLIC_FILES = ["index.html", "sw.js", "offline.html", "manifest.webmanifest", "favicon.ico", "robots.txt", "sitemap.xml", "llms.txt",
  "_headers", "_redirects"];   // Pages reads these two and never serves them
// served but harmless (no secrets, nothing members-only); listed so a new root file has to be decided on
const HARMLESS_FILES = ["README.md", "package.json", "package-lock.json", "vitest.config.js", ".env.example", ".gitignore", ".assetsignore", "qt=q_95.webp"];
// Pages never serves the functions/ folder itself: it runs it
const RUN_NOT_SERVED = ["functions"];
const BLOCKED_FOLDERS = ["supabase", "test", "docs", "workers", ".github", ".claude"];
const BLOCKED_FILES = ["MAINTENANCE.md", "Chikes_Creative_Space_PWA_Mobile_Implementation.md", "Chikes_Creative_Space_Content_Inventory_Updated.md"];

describe("the project's private files are not served by the live site", () => {
  it("answers a plain, uncached, unindexed 404 from one shared Function", async () => {
    const { onRequest } = await import("../functions/_shared/private.js");
    const res = onRequest();
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await res.text()).toBe("Not found");
  });
  it("blocks every private folder with a catch-all, and every private root file by name", () => {
    for (const d of BLOCKED_FOLDERS) {
      const f = new URL("../functions/" + d + "/[[path]].js", import.meta.url);
      expect(existsSync(f), d).toBe(true);
      expect(readFileSync(f, "utf8")).toContain('export { onRequest } from "../_shared/private.js";');
    }
    for (const name of BLOCKED_FILES) {
      const f = new URL("../functions/" + name + ".js", import.meta.url);
      expect(existsSync(f), name).toBe(true);
      expect(readFileSync(f, "utf8")).toContain('export { onRequest } from "./_shared/private.js";');
    }
  });
  it("has decided on every top-level folder and file in the repository", () => {
    for (const d of topFolders) expect(PUBLIC_FOLDERS.concat(BLOCKED_FOLDERS, RUN_NOT_SERVED), "folder " + d + "/ must be public or blocked").toContain(d);
    for (const f of topFiles) expect(PUBLIC_FILES.concat(HARMLESS_FILES, BLOCKED_FILES), "file " + f + " must be public, harmless or blocked").toContain(f);
  });
});
