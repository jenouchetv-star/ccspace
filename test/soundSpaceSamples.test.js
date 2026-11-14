import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { loadSS } from "./helpers/soundSpace.js";

const SS = loadSS("instruments.js");
const root = new URL("../assets/apps/sound-space/samples/", import.meta.url);
const recorded = SS.instruments.LIST.filter((i) => i.source === "recorded");

function expectedFiles(inst) {
  const s = inst.samples || {};
  if (s.notes) return s.notes.map((n) => `${n}.wav`);
  return s.files || [];
}

function wavInfo(buf) {
  expect(buf.toString("ascii", 0, 4)).toBe("RIFF");
  expect(buf.toString("ascii", 8, 12)).toBe("WAVE");
  let pos = 12;
  let fmt = null;
  let dataBytes = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      fmt = {
        format: buf.readUInt16LE(pos + 8),
        channels: buf.readUInt16LE(pos + 10),
        rate: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
    } else if (id === "data") {
      dataBytes = size;
    }
    pos += 8 + size + (size % 2);
  }
  return { ...fmt, dataBytes };
}

function walk(dir) {
  let total = 0;
  const big = [];
  for (const name of readdirSync(dir)) {
    const p = new URL(name, dir.href.endsWith("/") ? dir : dir.href + "/");
    const st = statSync(p);
    if (st.isDirectory()) {
      const sub = walk(new URL(p.href + "/"));
      total += sub.total;
      big.push(...sub.big);
    } else {
      total += st.size;
      if (st.size > 400 * 1024) big.push(p.pathname);
    }
  }
  return { total, big };
}

describe("Sound Space recorded samples", () => {
  const manifest = existsSync(new URL("manifest.json", root))
    ? JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"))
    : [];
  const rows = new Map(manifest.map((r) => [r.localUrl, r]));

  it("every recorded instrument has its prepared files and a manifest row for each", () => {
    expect(recorded.length).toBeGreaterThan(0);
    for (const inst of recorded) {
      const files = expectedFiles(inst);
      expect(files.length, inst.id).toBeGreaterThan(0);
      for (const f of files) {
        const rel = `${inst.id}/${f}`;
        const url = new URL(rel, root);
        expect(existsSync(url), `missing ${rel}`).toBe(true);
        const info = wavInfo(readFileSync(url));
        expect(info.format, rel).toBe(1);
        expect(info.channels, rel).toBe(1);
        expect(info.rate, rel).toBe(22050);
        expect(info.bits, rel).toBe(16);
        expect(info.dataBytes, rel).toBeGreaterThan(0);
        const row = rows.get(rel);
        expect(row, `manifest row for ${rel}`).toBeTruthy();
        expect(row.license, rel).toBe("CC0-1.0");
        expect(row.sourceUrl.startsWith("https://github.com/sgossner/"), rel).toBe(true);
        expect(row.version).toBe(1);
        expect(row.format).toBe("wav");
        expect(row.approved).toBe(true);
        expect(row.loopAllowed).toBe(false);
        expect(row.downloadDate).toBe("2026-11-14");
        expect(row.licenseEvidencePath).toMatch(/^docs\/sound-space\/licenses\/(VSCO-2-CE|VCSL)-LICENSE\.txt$/);
        expect(existsSync(new URL(`../../../../${row.licenseEvidencePath}`, root)), rel).toBe(true);
        expect(row.durationSeconds).toBeGreaterThan(0);
        expect(row.durationSeconds).toBeLessThanOrEqual(2.0001);
      }
    }
  });

  it("the prepared sounds stay small", () => {
    const { total, big } = walk(root);
    expect(total).toBeLessThan(25 * 1024 * 1024);
    expect(big).toEqual([]);
  });
});
