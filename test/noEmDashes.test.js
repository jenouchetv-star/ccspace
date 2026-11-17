// The owner asked (2026-11-16) for no em dashes anywhere on the site. This keeps them out of the site's own files.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const files = ["index.html", "sw.js", ...readdirSync(new URL("../games/", import.meta.url)).filter((f) => /\.(html|js)$/.test(f)).map((f) => "games/" + f),
  ...readdirSync(new URL("../supabase/private-games/", import.meta.url)).filter((f) => f.endsWith(".html")).map((f) => "supabase/private-games/" + f)];

describe("no em dashes on the site", () => {
  for (const f of files) it(f, () => { expect(read(f).includes("—")).toBe(false); });
});
