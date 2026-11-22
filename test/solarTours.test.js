import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { LINES, lineKey } from "../scripts/solar-lines.mjs";

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

/* ---------- the tours in the game: the engine (makeTours) runs here on its own, with a stand-in page and game ---------- */
const tourCode = html.split("/* BEGIN tours */")[1].split("/* END tours */")[0];
const makeTours = new Function(tourCode + "\nreturn makeTours;")();
/* the dock's own planet pictures */
const BALL = new Function("TEX", "return " + html.match(/const ballCss = (\{[\s\S]*?\});/)[1])("/assets/games/solar-system/");
const SAVE_KEY = "ccs-solar-system-sandbox-save";
const tour = id => TOURS.find(t => t.id === id);
const escT = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function fakeEl(){
  return { hidden: true, innerHTML: "", attrs: {}, listeners: {},
    setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); }, querySelector(){ return null; } };
}
/* the game's clock: each click comes a second after the one before (a card ignores Next and Back for 300 ms) */
let CLOCK = 1e6;
const later = (ms = 1000) => { CLOCK += ms; };
/* a click on a button the panel really shows */
function click(el, act, arg){
  later();
  const sel = 'data-act="' + act + '"' + (arg === undefined ? "" : ' data-arg="' + arg + '"');
  expect(el.innerHTML, sel).toContain(sel);
  const b = { disabled: false, getAttribute: k => (k === "data-act" ? act : arg === undefined ? null : String(arg)) };
  el.listeners.click.forEach(f => f({ target: { closest: () => b } }));
}
function boot({ grade = 2, stored = null, framed = true, noStorage = false } = {}){
  const calls = [], spoken = [], posts = [], store = {};
  if (stored) store[SAVE_KEY] = JSON.stringify(stored);
  const winL = {}, win = { addEventListener: (t, f) => { winL[t] = f; } };
  const parentWin = framed ? { postMessage: (m, o) => { expect(o).toBe("*"); posts.push(JSON.parse(JSON.stringify(m))); } } : win;
  const g = { current: null, comparing: false, ring: null, glow: false };
  const els = { btn: fakeEl(), list: fakeEl(), stop: fakeEl(), quiz: fakeEl() };
  const T = makeTours({
    data: TOURS, grade, els, names: NAMES, ballCss: BALL, real: H.REAL,
    select: id => { calls.push("select:" + id); g.current = id; },
    isOn: id => g.current === id,
    overview: () => { calls.push("overview"); g.current = null; },
    setCompare: on => { if (on !== g.comparing) calls.push("compare:" + on); g.comparing = on; },
    glowMove: on => { g.glow = on; }, ring: id => { g.ring = id; },
    speak: text => spoken.push(text), stopSpeaking: () => calls.push("hush"), sfx: () => {}, now: () => CLOCK,
    win, parentWin, ls: () => { if (noStorage) throw new Error("sealed"); return { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }; }
  });
  return { T, els, calls, spoken, posts, store, g, parentWin, win, message: (source, data) => winL.message({ source, data }),
    answers: () => posts.filter(p => p.ccsAnswer).map(p => p.ccsAnswer) };
}
/* what the camera was asked to do (speech cancels are left out) */
const cam = b => b.calls.filter(c => c !== "hush");
const openList = b => b.els.btn.listeners.click.forEach(f => f());
/* through a tour's stops to its quiz, tapping the right planet on the do stop */
function toQuiz(b, id){
  openList(b); click(b.els.list, "start", id);
  tour(id).stops.forEach(s => { if (s.kind === "do") expect(b.T.picked(s.do.answer)).toBe(true); click(b.els.stop, "next"); });
  expect(b.els.quiz.hidden).toBe(false);
}

describe("Solar System Sandbox tours: in the game", () => {
  it("Tours button and list", () => {
    const bar = html.slice(html.indexOf('<div class="bar">'), html.indexOf('<div class="pop" id="view"'));
    expect(bar).toContain('id="bTours"');
    expect(bar.indexOf('id="bTours"')).toBeLessThan(bar.indexOf('id="bPause"'));
    expect(html).toContain('else if (e.key === "t" || e.key === "T") tours.toggle();');

    const b = boot({ grade: 2 });
    expect(b.els.list.hidden).toBe(true);
    openList(b);
    expect(b.els.list.hidden).toBe(false);
    expect(b.els.btn.attrs["aria-expanded"]).toBe("true");
    const L = b.els.list.innerHTML;
    TOURS.forEach(t => expect(L).toContain("<b>" + t.title + "</b>"));
    expect(L).toContain("Playing at 2nd grade.");
    expect(L).toContain('data-act="change">Change</button>');
    expect(L).toContain("<small>4 stops</small>");
    expect(L).toContain("<small>3 stops, uses Compare sizes</small>");
    expect(L).toContain("<small>4 stops, move a planet</small>");
    expect(L).not.toContain("titem done");
    expect(b.T.back()).toBe(true);
    expect(b.els.list.hidden).toBe(true);
    expect(b.els.btn.attrs["aria-expanded"]).toBe("false");
    expect(b.T.back()).toBe(false);

    /* the site's grade sets the level: 0-1 k1, 2-3 g23, 4-6 g45 */
    expect([0, 1, 2, 3, 4, 5, 6].map(g => boot({ grade: g }).T.level())).toEqual(["k1", "k1", "g23", "g23", "g45", "g45", "g45"]);
    const k = boot({ grade: 0 });
    openList(k);
    expect(k.els.list.innerHTML).toContain("Playing at Kindergarten.");
  });

  it("asks the grade once when the site gives none, and remembers it", () => {
    const b = boot({ grade: null });
    openList(b);
    const L = b.els.list.innerHTML;
    expect(L).toContain("What grade are you in?");
    ["Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade"].forEach((n, k) => expect(L).toMatch(new RegExp('data-arg="' + k + '"( data-focus)?>' + n + "</button>")));
    expect(L).not.toContain('data-act="start"');
    click(b.els.list, "grade", 4);
    expect(b.els.list.innerHTML).toContain("Playing at 4th grade.");
    expect(b.T.level()).toBe("g45");
    expect(JSON.parse(b.store[SAVE_KEY]).grade).toBe(4);
    expect(b.posts).toContainEqual({ ccsSave: "set", game: "solar-system-sandbox", data: { done: [], grade: 4 } });
    /* next visit: no question; Change asks again */
    const again = boot({ grade: null, stored: { done: [], grade: 4 } });
    openList(again);
    expect(again.els.list.innerHTML).toContain("Playing at 4th grade.");
    click(again.els.list, "change");
    expect(again.els.list.innerHTML).toContain("What grade are you in?");
    click(again.els.list, "grade", 1);
    expect(again.T.level()).toBe("k1");
  });

  it("stop card reads aloud and cancels on close", () => {
    const b = boot({ grade: 2 }), t = tour("gas-giants");
    openList(b); click(b.els.list, "start", "gas-giants");
    expect(b.els.list.hidden).toBe(true);
    expect(b.els.stop.hidden).toBe(false);
    let s = b.els.stop.innerHTML;
    expect(s).toContain("Gas giants, stop 1 of 4");
    expect((s.match(/<i class="on"><\/i>/g) || []).length).toBe(1);
    expect((s.match(/<i( class="on")?><\/i>/g) || []).length).toBe(4);
    expect(s).toContain("<h3>" + t.stops[0].title.g23 + "</h3>");
    expect(s).toContain("Hear it again");
    expect(s).not.toContain('data-act="back"');
    expect(b.spoken.at(-1)).toBe(t.stops[0].text.g23);
    click(b.els.stop, "hear");
    expect(b.spoken.at(-1)).toBe(t.stops[0].text.g23);
    expect(b.spoken.length).toBe(2);
    click(b.els.stop, "next");
    s = b.els.stop.innerHTML;
    expect(s).toContain("Gas giants, stop 2 of 4");
    expect(s).toContain('data-act="back"');
    expect(b.calls).toContain("select:jupiter");
    expect(b.spoken.at(-1)).toBe(t.stops[1].text.g23);
    click(b.els.stop, "back");
    expect(b.els.stop.innerHTML).toContain("stop 1 of 4");
    b.calls.length = 0;
    click(b.els.stop, "close");
    expect(b.calls).toContain("hush");
    expect(b.calls.at(-1)).toBe("overview");
    expect(b.els.stop.hidden).toBe(true);
    expect(b.T.active()).toBe(false);
  });

  it("a do stop accepts only the right planet", () => {
    const b = boot({ grade: 2 });
    expect(b.T.picked("earth")).toBe(false);                     /* no tour: the tap plays as always */
    openList(b); click(b.els.list, "start", "gas-giants");
    expect(b.T.picked("saturn")).toBe(false);                    /* a show stop: the tap plays as always */
    click(b.els.stop, "next"); click(b.els.stop, "next");
    const d = tour("gas-giants").stops[2];
    expect(cam(b).at(-1)).toBe("overview");
    let s = b.els.stop.innerHTML;
    expect(s).toContain('<div class="tdo">');
    expect(s).toContain("Your turn: tap the biggest planet.");
    expect(s).not.toContain('data-act="next"');
    expect(b.spoken.at(-1)).toBe(d.text.g23 + " " + d.do.ask.g23);
    expect(b.T.picked("saturn")).toBe(true);
    s = b.els.stop.innerHTML;
    expect(s).toContain("That&#39;s Saturn. Try another one!");
    expect(s).not.toContain('data-act="next"');
    expect(b.g.ring).toBeNull();
    expect(b.T.picked("sun")).toBe(true);
    expect(b.els.stop.innerHTML).toContain("That&#39;s the Sun. Try another one!");
    expect(b.spoken.at(-1)).toBe("That's the Sun. Try another one!");
    b.T.act("next");                                               /* no Next button yet: nothing moves on */
    expect(b.els.stop.innerHTML).toContain("stop 3 of 4");
    expect(b.T.picked("jupiter")).toBe(true);
    s = b.els.stop.innerHTML;
    expect(s).toContain('<div class="tyes" role="status"><b>Yes, that&#39;s Jupiter!</b>');
    expect(s).not.toContain("Try another one");
    expect(s).toContain('data-act="next"');
    expect(b.g.ring).toBe("jupiter");
    expect(b.spoken.at(-1)).toBe(d.do.yes.g23);
    expect(b.T.picked("mars")).toBe(false);                      /* found: taps play as always again */
    click(b.els.stop, "next");
    expect(b.g.ring).toBeNull();
    expect(b.answers()).toEqual([]);                             /* nothing counts on a do stop */

    /* in Compare sizes, a tap on Earth is a wrong tap like any other */
    const c = boot({ grade: 2 });
    openList(c); click(c.els.list, "start", "earth-size");
    expect(c.calls).toContain("compare:true");
    click(c.els.stop, "next"); click(c.els.stop, "next");
    expect(c.g.comparing).toBe(true);
    expect(c.T.picked("earth")).toBe(true);
    expect(c.els.stop.innerHTML).toContain("That&#39;s Earth. Try another one!");
    expect(c.T.picked("venus")).toBe(true);
    expect(c.g.ring).toBe("venus");

    /* the game sends dock and space taps through the tour first, and plays them as always otherwise */
    expect(html).toContain("b.onclick = () => pickBody(p);");
    expect(html).toContain("pickBody(o === theSun ? SUN_BODY : P.find(p => p[key] === o));");
    expect(html).toContain("function pickBody(p){ if (tours.picked(p.id)) return; select(p); }");
  });

  it("goes to each stop's place: a planet, Compare sizes, and a planet's card with Move lit up", () => {
    const b = boot({ grade: 4 });
    openList(b); click(b.els.list, "start", "gravity");
    expect(b.calls).toContain("select:sun");
    click(b.els.stop, "next");
    expect(cam(b).at(-1)).toBe("select:earth");
    expect(b.g.glow).toBe(true);
    b.calls.length = 0;
    click(b.els.stop, "next");                                     /* Earth again: no new trip, Move no longer lit */
    expect(b.calls).not.toContain("select:earth");
    expect(b.g.glow).toBe(false);
    click(b.els.stop, "back");
    expect(b.g.glow).toBe(true);
    click(b.els.stop, "close");
    expect(b.g.glow).toBe(false);
  });

  it("an answer is sent once", () => {
    const b = boot({ grade: 2 }), Q = tour("gas-giants").quiz;
    toQuiz(b, "gas-giants");
    let q = b.els.quiz.innerHTML;
    expect(q).toContain("2nd and 3rd grade, question 1 of 3");
    expect(q).toContain("<span>Science</span>");
    expect((q.match(/class="topt"/g) || []).length).toBe(3);
    expect(q).not.toContain("tpic");
    const wrong = (Q[0].g23.answer + 1) % 3;
    b.T.act("answer", wrong); b.T.act("answer", wrong); b.T.act("answer", Q[0].g23.answer);
    expect(b.answers()).toEqual([{ game: "solar-system-sandbox", qid: "gas-giants-q1", subject: "science", level: "g23", correct: false,
      question: Q[0].g23.q, answer: Q[0].g23.choices[Q[0].g23.answer], why: Q[0].g23.why }]);
    q = b.els.quiz.innerHTML;
    expect(q).toContain("<b>Good try!</b>");
    expect(q).toContain('class="topt right"');
    expect(q).toContain('class="topt picked"');
    expect(q).not.toMatch(/class="[^"]*(red|wrong|bad)/);
    click(b.els.quiz, "next");
    expect(b.els.quiz.innerHTML).toContain("question 2 of 3");
    b.T.act("answer", Q[1].g23.answer); b.T.act("answer", Q[1].g23.answer);
    expect(b.els.quiz.innerHTML).toContain("<b>You got it!</b> " + escT(Q[1].g23.why));
    expect(b.answers().length).toBe(2);
    expect(b.answers()[1]).toMatchObject({ qid: "gas-giants-q2", correct: true });
    /* answering is only for the question on screen */
    later(); b.T.act("next"); b.T.act("answer", 0); b.T.act("answer", 1);
    expect(b.answers().length).toBe(3);
  });

  it("k1 shows two picture answers", () => {
    const b = boot({ grade: 0 }), Q = tour("sun").quiz;
    toQuiz(b, "sun");
    let q = b.els.quiz.innerHTML;
    expect(q).toContain("Kindergarten and 1st grade, question 1 of 3");
    expect((q.match(/class="tpic"/g) || []).length).toBe(2);
    expect(q).not.toContain("topt");
    expect(q).toContain('data-act="hear"');
    expect(q).toContain("background:" + BALL.sun + ";");
    expect(q).toContain("background:" + BALL.earth + ";");
    expect(b.spoken.at(-1)).toBe("Which one is a star? The Sun, or Earth?");
    click(b.els.quiz, "hear");
    expect(b.spoken.at(-1)).toBe("Which one is a star? The Sun, or Earth?");
    click(b.els.quiz, "answer", 0);
    expect(b.els.quiz.innerHTML).toContain('class="tpic right"');
    expect(b.spoken.at(-1)).toBe("You got it! " + Q[0].k1.why);
    expect(b.answers()[0]).toMatchObject({ level: "k1", correct: true, answer: "The Sun" });

    /* a size question shows the pictures at their real sizes: here Earth is a speck next to the Sun */
    const widths = () => [...b.els.quiz.innerHTML.matchAll(/class="ball" style="width:(\d+)px/g)].map(m => +m[1]);
    expect(widths()).toEqual([84, 84]);
    click(b.els.quiz, "next");
    const [earth, sun] = widths();
    expect(sun).toBe(96);
    expect(earth).toBeLessThanOrEqual(12);

    /* the other size questions: a clear difference */
    for (const [id, n] of [["earth-size", 0], ["earth-size", 2]]){
      const k = boot({ grade: 1 });
      toQuiz(k, id);
      for (let i = 0; i < n; i++){ k.T.act("answer", 0); click(k.els.quiz, "next"); }
      const w = [...k.els.quiz.innerHTML.matchAll(/class="ball" style="width:(\d+)px/g)].map(m => +m[1]);
      expect(Math.max(...w) / Math.min(...w), id + n).toBeGreaterThanOrEqual(1.8);
      const pics = tour(id).quiz[n].k1.pics, big = H.REAL[pics[0]] > H.REAL[pics[1]] ? 0 : 1;
      expect(w[big]).toBe(96);
    }
  });

  it("closing a tour cancels speech and resets the view", () => {
    /* mid-tour in Compare sizes */
    const c = boot({ grade: 2 });
    openList(c); click(c.els.list, "start", "earth-size");
    expect(c.g.comparing).toBe(true);
    c.calls.length = 0;
    expect(c.T.back()).toBe(true);                                 /* Escape */
    expect(c.calls).toEqual(["hush", "compare:false", "overview"]);
    expect(c.els.stop.hidden).toBe(true);
    expect(html).toContain("if (moving) return finishMove();\n  if (tours.back()) return;");
    expect(html).toContain("function startOver(){\n  tours.close();");

    /* mid-quiz: the answer already sent stays sent, nothing more is sent */
    const b = boot({ grade: 2 });
    toQuiz(b, "moons");
    b.T.act("answer", 0);
    b.calls.length = 0;
    click(b.els.quiz, "close");
    expect(b.calls[0]).toBe("hush");
    expect(b.calls.at(-1)).toBe("overview");
    expect(b.els.quiz.hidden).toBe(true);
    expect(b.els.quiz.innerHTML).toBe("");
    expect(b.T.active()).toBe(false);
    b.T.act("answer", 1); b.T.act("next");
    expect(b.answers().length).toBe(1);
    expect(b.T.picked("saturn")).toBe(false);
    expect(JSON.parse(b.store[SAVE_KEY] || '{"done":[]}').done).toEqual([]);   /* not finished, not done */

    /* opening the list leaves the tour too */
    const l = boot({ grade: 2 });
    openList(l); click(l.els.list, "start", "rings");
    openList(l);
    expect(l.T.active()).toBe(false);
    expect(l.els.stop.hidden).toBe(true);
    expect(l.els.list.hidden).toBe(false);
  });

  it("done tours are saved", () => {
    const b = boot({ grade: 3 }), Q = tour("rocky").quiz;
    expect(b.posts[0]).toEqual({ ccsSave: "get", game: "solar-system-sandbox" });
    toQuiz(b, "rocky");
    b.T.act("answer", Q[0].g23.answer); click(b.els.quiz, "next");
    b.T.act("answer", (Q[1].g23.answer + 1) % 3); click(b.els.quiz, "next");
    b.T.act("answer", Q[2].g23.answer); click(b.els.quiz, "next");
    expect(b.els.quiz.innerHTML).toContain("<h3>You got 2 of 3 right!</h3>");
    expect(b.spoken.at(-1)).toBe("You got 2 of 3 right!");
    expect(JSON.parse(b.store[SAVE_KEY])).toEqual({ done: ["rocky"], grade: null });
    expect(b.posts.at(-1)).toEqual({ ccsSave: "set", game: "solar-system-sandbox", data: { done: ["rocky"], grade: null } });
    click(b.els.quiz, "more");
    expect(b.els.quiz.hidden).toBe(true);
    const L = b.els.list.innerHTML;
    expect(L).toContain('class="titem done" data-act="start" data-arg="rocky"');
    expect(L.split('data-arg="rocky"')[1].split("</li>")[0]).toContain("Again");
    expect((L.match(/titem done/g) || []).length).toBe(1);

    /* the site's copy joins in, only from the page around the game */
    b.message({}, { ccsSave: "data", game: "solar-system-sandbox", data: { done: ["sun"] } });
    b.message(b.parentWin, { ccsSave: "data", game: "other-game", data: { done: ["sun"] } });
    expect(b.T.save().done).toEqual(["rocky"]);
    b.message(b.parentWin, { ccsSave: "data", game: "solar-system-sandbox", data: { done: ["moons", "bogus", "moons"], grade: 5 } });
    expect(b.T.save()).toEqual({ done: ["rocky", "moons"], grade: 5 });
    expect((b.els.list.innerHTML.match(/titem done/g) || []).length).toBe(2);
    b.message(b.parentWin, { ccsSave: "data", game: "solar-system-sandbox", data: null });
    expect(b.T.save().done).toEqual(["rocky", "moons"]);

    /* a sealed frame with no storage, and a page opened on its own, still play */
    const s = boot({ grade: 2, noStorage: true });
    toQuiz(s, "sun");
    expect(s.answers().length).toBe(0);
    s.T.act("answer", 0);
    expect(s.answers().length).toBe(1);
    const alone = boot({ grade: 2, framed: false });
    toQuiz(alone, "sun");
    alone.T.act("answer", 0);
    expect(alone.posts).toEqual([]);
    alone.message(alone.win, { ccsSave: "data", game: "solar-system-sandbox", data: { done: ["sun"] } });
    expect(alone.T.save().done).toEqual([]);
  });

  it("puts tour words into the page only through esc()", () => {
    const evil = JSON.parse(JSON.stringify(TOURS));
    evil[0].title = '<img src=x onerror="alert(1)">';
    evil[0].stops[0].text.g23 = "<b>bold</b> & more";
    const els = { btn: fakeEl(), list: fakeEl(), stop: fakeEl(), quiz: fakeEl() };
    const T = makeTours({ data: evil, grade: 2, els, names: NAMES, ballCss: BALL, real: H.REAL, select(){}, isOn: () => false, overview(){}, setCompare(){},
      glowMove(){}, ring(){}, speak(){}, stopSpeaking(){}, sfx(){}, win: { addEventListener(){} }, parentWin: null, ls: () => null });
    T.setList(true);
    expect(els.list.innerHTML).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(els.list.innerHTML).not.toContain("<img");
    T.act("start", evil[0].id);
    expect(els.stop.innerHTML).toContain("&lt;b&gt;bold&lt;/b&gt; &amp; more");
  });

  it("reads aloud in Heart's recorded voice, never the browser's built-in one", () => {
    expect(html).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance/);
    expect(html).toContain('const VOICE_DIR = "/assets/games/solar-tours/voice/";');
    const voice = html.split("const VOICE_DIR")[1].split("/* a tap on a planet")[0];
    expect(voice).toContain("if (!text || (window.CCSSound && !CCSSound.isOn())) return;");
    expect(voice).toContain('voiceClip.src = VOICE_DIR + lineKey(text.trim()) + ".mp3";');
    expect(voice).toContain('CCSSound.volume("sfx")');
    expect(voice).toContain("function stopSpeaking(){ try { voiceClip.pause(); } catch (_e) {} }");
    expect(html).toContain("speak: speak, stopSpeaking: stopSpeaking,");
    /* the game's hash is the script's */
    const gameKey = new Function("return " + html.match(/function lineKey\(text\)\{[\s\S]*?\n\}/)[0])();
    for (const t of ["You got 2 of 3 right!", "That's Saturn. Try another one!", "Which one is a star? The Sun, or Earth?"]) expect(gameKey(t)).toBe(lineKey(t));
  });

  it("every line the game can speak is in scripts/solar-lines.mjs", () => {
    const list = new Set(LINES), heard = new Set();
    const BODIES = ["sun"].concat(PLANET_IDS);
    for (const grade of [0, 2, 4]) for (const t of TOURS) for (const run of ["right", "wrong", "mixed"]){
      const b = boot({ grade });
      openList(b); click(b.els.list, "start", t.id);
      t.stops.forEach(s => {
        click(b.els.stop, "hear");
        if (s.kind === "do"){
          BODIES.filter(id => id !== s.do.answer).forEach(id => { expect(b.T.picked(id)).toBe(true); click(b.els.stop, "hear"); });
          expect(b.T.picked(s.do.answer)).toBe(true);
          click(b.els.stop, "hear");
        }
        click(b.els.stop, "next");
      });
      t.quiz.forEach((q, i) => {
        const L = b.T.level(), right = q[L].answer, pick = run === "right" || (run === "mixed" && i % 2) ? right : (right + 1) % q[L].choices.length;
        if (L === "k1") click(b.els.quiz, "hear");
        click(b.els.quiz, "answer", pick);
        if (L === "k1") click(b.els.quiz, "hear");
        click(b.els.quiz, "next");
      });
      expect(b.els.quiz.innerHTML).toContain("right!</h3>");
      b.spoken.forEach(x => heard.add(x));
    }
    expect(heard.size).toBeGreaterThan(200);
    for (const x of heard) expect(list.has(x.trim()), x).toBe(true);
    /* keys are unique, so no two lines share a clip */
    expect(new Set(LINES.map(lineKey)).size).toBe(LINES.length);
  });

  it("a quick double tap on Next can't skip a stop", () => {
    const b = boot({ grade: 2 });
    openList(b); click(b.els.list, "start", "gas-giants");
    click(b.els.stop, "next");
    expect(b.els.stop.innerHTML).toContain("stop 2 of 4");
    later(120); b.T.act("next");                                  /* the second tap of a double tap */
    expect(b.els.stop.innerHTML).toContain("stop 2 of 4");
    later(120); b.T.act("back");
    expect(b.els.stop.innerHTML).toContain("stop 2 of 4");
    later(300); b.T.act("next");
    expect(b.els.stop.innerHTML).toContain("stop 3 of 4");
    /* the quiz too: a fresh question ignores a Next tap at once */
    const q = boot({ grade: 2 });
    toQuiz(q, "moons");
    q.T.act("answer", 0); q.T.act("next");
    expect(q.els.quiz.innerHTML).toContain("question 1 of 3");
    later(); q.T.act("next");
    expect(q.els.quiz.innerHTML).toContain("question 2 of 3");
  });

  it("on a phone an open banner pushes the stop card and the list below it", () => {
    const src = html.match(/function placeTourCards\(\)\{[\s\S]*?\n\}/)[0];
    const el = (open, bottom) => ({ style: {}, classList: { contains: c => c === "open" && open }, getBoundingClientRect: () => ({ bottom }) });
    const run = (w, banner, cmp) => {
      const els = { banner, cmpBanner: cmp, tours: el(false, 0) }, stop = el(false, 0);
      new Function("$", "tourStop", "innerWidth", src + "\nplaceTourCards();")(id => els[id], stop, w);
      return { stop: stop.style.top, list: els.tours.style.top, listMax: els.tours.style.maxHeight };
    };
    expect(run(375, el(false, 120), el(true, 131))).toEqual({ stop: "139px", list: "139px", listMax: "calc(100% - 229px)" });
    expect(run(375, el(true, 104), el(false, 0))).toEqual({ stop: "112px", list: "112px", listMax: "calc(100% - 202px)" });
    expect(run(375, el(false, 0), el(false, 0))).toEqual({ stop: "", list: "", listMax: "" });          /* no banner: the CSS place */
    expect(run(1280, el(true, 120), el(false, 0))).toEqual({ stop: "", list: "", listMax: "" });        /* wide: the card is bottom-left */
    /* it follows the banners opening and closing, and the window's size */
    expect(html).toContain('["banner", "cmpBanner"].forEach(id => new MutationObserver(placeTourCards).observe($(id), { attributes: true, attributeFilter: ["class"] }));');
    expect(html).toContain('addEventListener("resize", placeTourCards);');
    /* the Move stop lights the button without scrolling the phone's planet sheet */
    expect(html).toContain('glowMove: on => $("cMove").classList.toggle("tglow", on),');
  });
});
