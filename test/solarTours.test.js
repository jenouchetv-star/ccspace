import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Solar System Sandbox tours: the words live in a JSON block inside the private game file */
const html = readFileSync(new URL("../supabase/private-games/solar-system-sandbox.html", import.meta.url), "utf8");

function toursBlock(){
  const m = html.match(/<script type="application\/json" id="toursData">([\s\S]*?)<\/script>/);
  return m ? m[1] : null;
}
const raw = toursBlock();
const TOURS = raw ? JSON.parse(raw) : [];

/* the game's own numbers: the fact cards (INFO), real widths (REAL) and the planets' years (P) */
const helpers = html.slice(html.indexOf("/* ---------- small pure helpers"), html.indexOf("/* ---------- scene"));
const H = new Function(helpers + "\nreturn { yearText, milesText, weighLb, REAL, INFO };")();
const P = [...html.matchAll(/\{ id: "(\w+)",\s*name: "(\w+)",[^}]*?per: (\d+)/g)].map(m => ({ id: m[1], name: m[2], per: +m[3] }));
const PLANET_IDS = P.map(p => p.id);
const BODY_IDS = ["sun"].concat(PLANET_IDS);
const LEVELS = ["k1", "g23", "g45"];

/* every piece of text a child can see or hear */
function allStrings(){
  const out = [];
  const lv = o => LEVELS.forEach(k => out.push(o[k]));
  TOURS.forEach(t => {
    out.push(t.title);
    t.stops.forEach(s => { lv(s.title); lv(s.text); if (s.do){ lv(s.do.ask); lv(s.do.yes); } });
    t.quiz.forEach(q => LEVELS.forEach(k => { out.push(q[k].q, q[k].why, ...q[k].choices); }));
  });
  return out;
}
const NAMES = { sun: "Sun" }; P.forEach(p => { NAMES[p.id] = p.name; });
const named = (s, ids) => ids.filter(id => new RegExp("\\b" + NAMES[id] + "\\b").test(s));
/* each sentence with the one planet (and one body other than Earth) it is about: named in it, or named in the
   sentence before when this one starts with "It" or "Its". "as wide as Earth", "than Earth" only compare, so
   that Earth is not counted as the subject. */
function sentences(){
  const out = [];
  allStrings().forEach(str => {
    let lastP = null, lastB = null;
    str.split(/(?<=[.!?])\s+/).forEach(s => {
      const core = s.replace(/\b(?:as wide as|as big as|than|as) Earth\b(?!')/g, "");
      const ps = named(core, PLANET_IDS), bs = named(core, BODY_IDS).filter(id => id !== "earth");
      const pronoun = /^(It|Its)\b/.test(s);
      const planet = ps.length === 1 ? ps[0] : (!ps.length && pronoun ? lastP : null);
      const body = bs.length === 1 ? bs[0] : (!bs.length && pronoun ? lastB : null);
      out.push({ s, planet, body, whole: str });
      lastP = ps.length === 1 ? ps[0] : ps.length ? null : lastP;
      lastB = bs.length === 1 ? bs[0] : bs.length ? null : lastB;
    });
  });
  return out;
}

describe("Solar System Sandbox tours: the content", () => {
  it("is valid JSON in its own block, with no closing script tag inside", () => {
    expect(raw).not.toBeNull();
    expect(raw).not.toMatch(/<\/script/i);
    expect(Array.isArray(TOURS)).toBe(true);
    expect(P.length).toBe(8);
  });

  it("8 tours with the owner's names", () => {
    expect(TOURS.map(t => t.title)).toEqual([
      "The Sun, our star", "Rocky planets", "Gas giants", "Why we have years",
      "Moons", "How big is Earth?", "Gravity holds us", "Rings and ice"
    ]);
    const ids = TOURS.map(t => t.id);
    expect(new Set(ids).size).toBe(8);
    ids.forEach(id => expect(id).toMatch(/^[a-z][a-z0-9-]*$/));
  });

  it("every stop has all three reading levels", () => {
    const targetOk = t => BODY_IDS.includes(t) || t === "overview" || t === "compare" ||
      (t.startsWith("move:") && PLANET_IDS.includes(t.slice(5)));
    TOURS.forEach(t => {
      expect(t.stops.length).toBeGreaterThanOrEqual(3);
      expect(t.stops.length).toBeLessThanOrEqual(4);
      t.stops.forEach(s => {
        expect(["show", "do"]).toContain(s.kind);
        expect(targetOk(s.target), t.id + " target " + s.target).toBe(true);
        LEVELS.forEach(k => {
          expect(typeof s.title[k]).toBe("string"); expect(s.title[k].trim().length).toBeGreaterThan(0);
          expect(typeof s.text[k]).toBe("string"); expect(s.text[k].trim().length).toBeGreaterThan(0);
        });
        /* the youngest read the shortest words */
        expect(s.text.k1.split(/\s+/).length).toBeLessThanOrEqual(s.text.g45.split(/\s+/).length);
      });
    });
    /* the owner's tour features: Compare sizes and Move a planet */
    expect(TOURS.find(t => t.title === "How big is Earth?").stops.some(s => s.target === "compare")).toBe(true);
    expect(TOURS.find(t => t.title === "Gravity holds us").stops.some(s => s.target.startsWith("move:"))).toBe(true);
  });

  it("one do-something stop per tour, answering with a real planet id", () => {
    TOURS.forEach(t => {
      const dos = t.stops.filter(s => s.kind === "do");
      expect(dos.length, t.id).toBe(1);
      const d = dos[0].do;
      expect(PLANET_IDS).toContain(d.answer);
      /* the child taps in a view where every planet can be tapped, and never the planet the camera is already on */
      expect(["overview", "compare"], t.id).toContain(dos[0].target);
      expect(d.answer).not.toBe(dos[0].target);
      LEVELS.forEach(k => {
        expect(d.ask[k]).toMatch(/^Tap /);
        expect(d.yes[k]).toContain(NAMES[d.answer]);
      });
      t.stops.filter(s => s.kind === "show").forEach(s => expect(s.do).toBeUndefined());
    });
  });

  it("3 questions per tour, 2 choices for k1 and 3 for the others, answer within choices", () => {
    const used = { k1: new Set(), g23: new Set(), g45: new Set() };
    TOURS.forEach(t => {
      expect(t.quiz.length).toBe(3);
      t.quiz.forEach((q, i) => {
        expect(q.id).toBe(t.id + "-q" + (i + 1));
        expect(q.subject).toBe("science");
        LEVELS.forEach(k => {
          const L = q[k];
          expect(L.choices.length).toBe(k === "k1" ? 2 : 3);
          expect(Number.isInteger(L.answer)).toBe(true);
          expect(L.answer).toBeGreaterThanOrEqual(0);
          expect(L.answer).toBeLessThan(L.choices.length);
          expect(new Set(L.choices).size).toBe(L.choices.length);
          expect(L.q.trim().length).toBeGreaterThan(0);
          expect(L.why.trim().length).toBeGreaterThan(0);
          used[k].add(L.answer);
        });
        /* k1 answers are pictures of real bodies, in the same order as the choices */
        expect(q.k1.pics.length).toBe(2);
        q.k1.pics.forEach((id, j) => {
          expect(BODY_IDS).toContain(id);
          expect(q.k1.choices[j]).toContain(NAMES[id]);
        });
      });
    });
    /* the right answer is not always in the same place */
    expect(used.k1.size).toBe(2);
    expect(used.g23.size).toBe(3);
    expect(used.g45.size).toBe(3);
  });

  it("no em dashes, no emojis, no he/she", () => {
    const all = allStrings();
    expect(all.length).toBeGreaterThan(300);
    all.forEach(s => {
      expect(s).not.toMatch(/[—–]/);
      expect(s).not.toMatch(/\s-\s/);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s).not.toMatch(/\b(he|she|him|her|his|hers|himself|herself)\b/i);
    });
  });

  it("never says a big planet pulls harder (pull comes from mass; Uranus is 4x Earth's width but pulls less)", () => {
    sentences().forEach(({ s }) => {
      expect(s).not.toMatch(/\b(big|bigger|biggest|huge|large|larger|largest)\b[^.!?]*\b(pull|pulls|gravity)\b/i);
    });
  });

  it("facts agree with the fact cards", () => {
    let checked = 0;
    const num = s => +s.replace(/,/g, "");
    const words = { one: 1, two: 2 };
    let moonChecks = 0;
    sentences().forEach(({ s, planet, body, whole }) => {
      /* years: "88 days", "165 years" next to one planet must be that planet's year on its card */
      const yr = s.match(/\b(\d[\d,.]*) (days|years)\b/);
      if (yr && planet){
        const p = P.find(x => x.id === planet);
        expect(yr[1] + " " + yr[2], s).toBe(H.yearText(p.per));
        checked++;
      }
      /* moons: "over 90 moons", "2 small moons", "one moon", and "It has more than 90!" in a line about moons */
      const mn = s.match(/\b(over \d+|\d+|one|two) (?:\w+ )?moons?\b/i) ||
        (/moon/i.test(whole) && s.match(/\b((?:over|more than) \d[\d,]*)(?=[!.]|,\s|$)/i));
      if (mn && planet){
        const v = mn[1].toLowerCase().replace("more than", "over");
        expect(String(words[v] || v), s).toBe(H.INFO[planet].moons.toLowerCase());
        checked++; moonChecks++;
      }
      /* sizes: "11 times as wide as Earth" */
      const sz = s.match(/\b(\d+(?:\.\d+)?) times as wide\b/);
      if (sz && body){
        const dec = (sz[1].split(".")[1] || "").length, f = Math.pow(10, dec);
        expect(Math.round(H.REAL[body] * f) / f, s).toBe(+sz[1]);
        checked++;
      }
      /* distances: "93 million miles", "2.8 billion miles" */
      const mi = s.match(/\b(\d[\d.]*) (million|billion) miles\b/);
      if (mi && planet){
        expect(mi[1] + " " + mi[2] + " mi", s).toBe(H.milesText(H.INFO[planet].miles));
        checked++;
      }
      /* weights: a 60 pound kid, and what that kid weighs there */
      const lbs = [...s.matchAll(/\b(\d+) pounds\b/g)].map(m => num(m[1]));
      if (lbs.length && planet){
        lbs.forEach(n => expect([60, H.weighLb(H.INFO[planet].g)], s).toContain(n));
        checked++;
      }
      /* Jupiter has no ground: a weight there is at its cloud tops, as on the fact card */
      if (/\bpounds\b/.test(s) && /\bJupiter\b/.test(s)) expect(s).toMatch(/cloud tops/);
    });
    expect(checked).toBeGreaterThanOrEqual(20);
    expect(moonChecks).toBeGreaterThanOrEqual(8);
    /* a few the owner named */
    const text = allStrings().join(" ");
    expect(text).toMatch(/Jupiter has over 90 moons/);
    expect(text).toMatch(/over 270 moons/);
    expect(text).toMatch(/\b88 days\b/);
    expect(text).toMatch(/\b365 days\b/);
    expect(text).toMatch(/\b165 years\b/);
  });
});
