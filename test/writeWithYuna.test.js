// Write with Yuna (owner-approved mockup docs/mockups/writing-game-draft.html; decisions in
// docs/superpowers/specs/2026-11-22-write-with-yuna-design.md). The letter models, the scoring, the content and the
// answers live in the game's pure block, so they are tested here directly.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { answerFromMessage } from "../assets/lib/progress.js";
import { LINES as SCRIPT_LINES, lineKey as scriptKey } from "../scripts/yuna-lines.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const game = read("supabase/private-games/write-with-yuna.html");
const pad = read("games/write-with-yuna-pad.html");
const pure = game.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const W = new Function(pure + "; return { MODELS, PUNCT, parseStroke, letterModel, layoutText, resample, pathLen, viewBoxFor, decorFor, compareStrokes, scoreWriting, TIPS, FIXED, GRADES, levelOf, gradeFrom, itemsFor, answerFor, lineKey, allLines, touchOnly, startChoices, roomCode, readCode, cleanName, cleanInk };")();
const padPure = pad.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const PD = new Function(padPure + "; return { readCode, cleanView, padView };")();

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), LOWER = "abcdefghijklmnopqrstuvwxyz".split("");
const strokesOf = (text, style) => W.layoutText(text, style).strokes.map(s => s.pts);
const nameItem = (g) => W.itemsFor(g).find(it => it.kind === "name");
const textOf = (it) => (it.kind === "name" ? "Maya Lee" : it.text);

describe("the letter models", () => {
  it("has every print and cursive letter, capital and lowercase, plus the punctuation the sentences use", () => {
    for (const style of ["print", "cursive"]) for (const ch of UPPER.concat(LOWER)) expect(W.MODELS[style][ch], style + " " + ch).toBeTruthy();
    for (const ch of ".,'-!?") expect(W.MODELS.print[ch], ch).toBeTruthy();
  });
  it("every stroke has at least 2 points and starts inside the letter's box on the lines", () => {
    for (const style of ["print", "cursive"]) for (const ch of Object.keys(W.MODELS[style])){
      const m = W.letterModel(style, ch);
      expect(m.strokes.length, style + " " + ch).toBeGreaterThan(0);
      m.strokes.forEach((st, k) => {
        expect(st.length, style + " " + ch + " stroke " + (k + 1)).toBeGreaterThanOrEqual(2);
        const [x, y] = st[0];
        expect(x, style + " " + ch).toBeGreaterThanOrEqual(-1);
        expect(x, style + " " + ch).toBeLessThanOrEqual(Math.max(m.w, 6) + 1);
        expect(y, style + " " + ch).toBeGreaterThanOrEqual(-1);
        expect(y, style + " " + ch).toBeLessThanOrEqual(150);
        st.forEach(p => { expect(p[1]).toBeGreaterThanOrEqual(-6); expect(p[1]).toBeLessThanOrEqual(152); });
      });
    }
  });
  it("print capitals stand from the top line to the base line; lowercase bodies sit between the dashed and base lines", () => {
    for (const ch of UPPER){ const ys = W.letterModel("print", ch).strokes.flat().map(p => p[1]); expect(Math.min(...ys), ch).toBeLessThanOrEqual(2); expect(Math.max(...ys), ch).toBeGreaterThanOrEqual(98); }
    for (const ch of "acemnorsuvwxz"){ const ys = W.letterModel("print", ch).strokes.flat().map(p => p[1]); expect(Math.min(...ys), ch).toBeGreaterThanOrEqual(48); expect(Math.max(...ys), ch).toBeLessThanOrEqual(101); }
    for (const ch of "gjpqy"){ const ys = W.letterModel("print", ch).strokes.flat().map(p => p[1]); expect(Math.max(...ys), ch).toBeGreaterThan(120); }
  });
  it("ball-and-stick starts the way teachers show them: B, D, E, L, P down from the top first; O and C go counterclockwise", () => {
    for (const ch of "BDEFHKLMNPR"){ const s = W.letterModel("print", ch).strokes[0]; expect(s[0][1], ch).toBe(0); expect(s[s.length - 1][1], ch).toBeGreaterThan(90); }
    for (const ch of "OC"){ const s = W.letterModel("print", ch).strokes[0]; expect(s[3][0], ch).toBeLessThan(s[0][0]); }   /* leaves the start toward the left, over the top */
  });
  it("cursive lowercase letters enter on the base line and leave on it (b o v w on the middle line), so words join", () => {
    for (const ch of LOWER){
      const main = W.MODELS.cursive[ch][0], m = W.letterModel("cursive", ch), s = m.strokes[0], end = s[s.length - 1];
      expect(main.startsWith("M0 100"), ch).toBe(true);
      expect(end[1], ch).toBe("bovw".includes(ch) ? 56 : 100);
      expect(end[0], ch).toBe(m.w);
    }
  });
  it("a cursive word is one joined stroke, with the dots and crosses after it", () => {
    const art = W.layoutText("art", "cursive").strokes;
    expect(art).toHaveLength(2);   /* a-r-t joined, then the t's cross */
    const it = W.layoutText("kite", "cursive").strokes;
    expect(it).toHaveLength(3);   /* joined, then the i's dot, then the t's cross */
    expect(W.pathLen(it[1].pts)).toBeLessThan(6);
    const word = W.layoutText("ow", "cursive").strokes;   /* after o, the w starts on the middle line */
    expect(word).toHaveLength(1);
  });
  it("print words leave space between letters and between words", () => {
    const L = W.layoutText("a cat", "print");
    expect(L.chars.map(c => c.ch).join("")).toBe("acat");
    expect(L.chars[1].x - L.chars[0].x).toBeGreaterThan(50);   /* a word space */
    expect(L.maxX).toBeGreaterThan(150);
  });
  it("every stroke gets a number, and every stroke longer than a dot gets an orange arrow", () => {
    const L = W.layoutText("B", "print"), D = W.decorFor(L);
    expect(D.nums.map(n => n.n)).toEqual([1, 2, 3]);
    expect(D.arrows.every(a => Array.isArray(a) && a.length >= 2)).toBe(true);
    expect(D.start).toEqual(L.strokes[0].pts[0]);
    const i = W.decorFor(W.layoutText("i", "print"));
    expect(i.arrows[1]).toBeNull();
    expect(game).toContain('fill="#E07A1F"');   /* the arrowheads are orange */
  });
});

describe("scoring", () => {
  it("the model itself gets 3 stars, every letter in both styles, at every level", () => {
    for (const style of ["print", "cursive"]) for (const ch of Object.keys(W.MODELS[style])){
      const m = strokesOf(ch, style);
      for (const L of ["k1", "g23", "g45"]) expect(W.scoreWriting(m, m, L, false).stars, style + " " + ch + " " + L).toBe(3);
    }
  });
  it("every item of every grade, written exactly like the model, gets 3 stars", () => {
    for (const g of W.GRADES) for (const it of W.itemsFor(g.id)){
      const m = strokesOf(textOf(it), it.style);
      expect(W.scoreWriting(m, m, W.levelOf(g.id), it.kind !== "letter").stars, it.id).toBe(3);
    }
  });
  it("a stroke written backward gets low stars and the arrow tip", () => {
    const l = strokesOf("l", "print"), r = W.scoreWriting(l, l.map(s => s.slice().reverse()), "k1", false);
    expect(r.stars).toBeLessThanOrEqual(1);
    expect(r.parts.dir).toBeLessThan(0.2);
    const o = strokesOf("o", "print"), ro = W.scoreWriting(o, o.map(s => s.slice().reverse()), "g23", false);
    expect(ro.stars).toBeLessThanOrEqual(1);
    expect(["start", "dir"]).toContain(ro.tip);
  });
  it("a letter written far from the model gets no stars", () => {
    const B = strokesOf("B", "print");
    const r = W.scoreWriting(B, B.map(s => s.map(p => [p[0] + 150, p[1]])), "k1", false);
    expect(r.stars).toBe(0);
    expect(W.scoreWriting(B, [], "k1", false).stars).toBe(0);
    expect(W.scoreWriting(B, [], "k1", false).tip).toBe("write");
  });
  it("starting the first stroke at the bottom of a top-down letter gives the top-down tip", () => {
    const B = strokesOf("B", "print");
    const r = W.scoreWriting(B, [B[0].slice().reverse(), B[1], B[2]], "g23", false);
    expect(r.stars).toBeLessThan(3);
    expect(r.tip).toBe("topDown");
  });
  it("strokes in the wrong order lose a star", () => {
    const B = strokesOf("B", "print");
    const r = W.scoreWriting(B, [B[1], B[0], B[2]], "g23", false);
    expect(r.stars).toBe(2);
    expect(r.tip).toBe("order");
  });
  it("is generous for K-1: a slightly shaky, shifted letter still gets 2 or 3 stars", () => {
    const A = strokesOf("A", "print");
    const shaky = A.map(s => s.map((p, k) => [p[0] + 6 + (k % 2 ? 3 : -3), p[1] + 5]));
    expect(W.scoreWriting(A, shaky, "k1", false).stars).toBeGreaterThanOrEqual(2);
  });
  it("resamples a stroke to even steps, ends kept", () => {
    const r = W.resample([[0, 0], [0, 20]], 4);
    expect(r).toHaveLength(6);
    expect(r[5]).toEqual([0, 20]);
    expect(W.resample([[3, 4]], 4)).toEqual([[3, 4]]);
  });
});

describe("what each grade writes", () => {
  it("K writes every letter, capital then lowercase, with its name, sound and word", () => {
    const k = W.itemsFor(0);
    expect(k).toHaveLength(52);
    expect(k[2].id).toBe("write-upper-b"); expect(k[3].id).toBe("write-lower-b");
    expect(k[2].sound).toBe("B says /b/, like ball");
    expect(k[2].big).toBe("B b");
    expect(k[2].say).toBe("Capital B. B says buh, like ball.");
  });
  it("1st writes the full name first, then about 20 sight words and 20 short words", () => {
    const one = W.itemsFor(1);
    expect(one[0].kind).toBe("name");
    expect(one.filter(it => it.kind === "word").length).toBeGreaterThanOrEqual(40);
    expect(one.map(it => it.text)).toEqual(expect.arrayContaining(["the", "and", "see", "said", "cat", "ship", "frog"]));
  });
  it("2nd writes words, then 10 short sentences that start with a capital and end with a period", () => {
    const two = W.itemsFor(2), s = two.filter(it => it.kind === "sentence");
    expect(two.filter(it => it.kind === "word").length).toBeGreaterThanOrEqual(20);
    expect(s).toHaveLength(10);
    s.forEach(it => expect(it.text).toMatch(/^[A-Z][a-z' ]+[a-z]\.$/));
  });
  it("3rd writes cursive lowercase by families (c a d g o q first), then cursive capitals", () => {
    const three = W.itemsFor(3);
    expect(three).toHaveLength(52);
    expect(three.slice(0, 6).map(it => it.text).join("")).toBe("cadgoq");
    expect(new Set(three.slice(0, 26).map(it => it.text)).size).toBe(26);
    expect(three.slice(26).map(it => it.text).join("")).toBe(UPPER.join(""));
    three.forEach(it => expect(it.style).toBe("cursive"));
  });
  it("4th and 5th write cursive words, then their own name and a sentence", () => {
    for (const g of [4, 5]){
      const list = W.itemsFor(g), kinds = list.map(it => it.kind);
      expect(kinds.indexOf("name")).toBeGreaterThan(kinds.lastIndexOf("word"));
      expect(kinds.indexOf("sentence")).toBeGreaterThan(kinds.indexOf("name"));
      list.forEach(it => expect(it.style).toBe("cursive"));
    }
  });
  it("every word and sentence can be written with the models", () => {
    for (const g of W.GRADES) for (const it of W.itemsFor(g.id)) for (const ch of textOf(it)){
      if (ch === " ") continue;
      expect(W.MODELS.print[ch] || W.MODELS.cursive[ch], it.id + " " + ch).toBeTruthy();
    }
  });
  it("6th grade writes with 5th; K-1, 2nd-3rd and 4th-5th report at the site's three levels", () => {
    expect(W.gradeFrom(6)).toBe(5); expect(W.gradeFrom(0)).toBe(0); expect(W.gradeFrom(null)).toBeNull();
    expect([0, 1, 2, 3, 4, 5].map(W.levelOf)).toEqual(["k1", "k1", "g23", "g23", "g45", "g45"]);
  });
});

describe("the progress report", () => {
  it("every item's answer is one the site accepts, for Reading, with a short write- qid", () => {
    const ids = new Set();
    for (const g of W.GRADES) for (const it of W.itemsFor(g.id)){
      for (const stars of [0, 1, 2, 3]){
        const a = W.answerFor(it, g.id, stars, stars === 3 ? "great" : "dir");
        expect(a.qid).toMatch(/^write-[a-z0-9-]+$/);
        expect(a.qid.length).toBeLessThanOrEqual(40);
        expect(a.correct).toBe(stars >= 2);
        const ok = answerFromMessage({ ccsAnswer: a });
        expect(ok, it.id).not.toBeNull();
        expect(ok.subject).toBe("reading");
        expect(ok.game).toBe("write-with-yuna");
        expect(ok.level).toBe(W.levelOf(g.id));
      }
      ids.add(g.id + ":" + it.id);
    }
    expect(W.answerFor(W.itemsFor(0)[2], 0, 3, "great")).toMatchObject({ question: "Write the capital letter B.", answer: "B", why: "Great writing!" });
    expect(W.answerFor(W.itemsFor(1)[1], 1, 2, "start").question).toBe("Write the word the.");
  });
  it("never puts the child's name in an answer", () => {
    for (const g of [1, 4, 5]){
      const it = Object.assign({}, nameItem(g), { text: "Maya Lee", big: "Maya Lee" });
      const a = W.answerFor(it, g, 3, "great"), json = JSON.stringify(a);
      expect(a.answer).toBe("your name");
      expect(a.question).toMatch(/^Write your name/);
      expect(json).not.toMatch(/Maya|Lee/);
    }
    /* the game builds answers only from the item's fixed question and answer */
    expect(game).toContain("toParent({ ccsAnswer: answerFor(G.item, G.grade, r.stars, r.tip) })");
    expect(game).not.toMatch(/ccsAnswer[^\n]*(fullName|SAVE\.first|SAVE\.last)/);
  });
  it("posts one answer per item, only On your own, and only inside the site", () => {
    expect(game.match(/ccsAnswer:/g)).toHaveLength(1);
    expect(game).toContain("if (!G.sent[G.item.id]){ G.sent[G.item.id] = true; toParent({ ccsAnswer:");
    expect(game).toContain('if (G.phase !== "own") return;');
    expect(game).toContain("function toParent(msg){ if (!INSIDE) return;");
  });
  it("keeps the name on this device: the site's saved data or, opened alone, this browser", () => {
    expect(game).toContain('toParent({ ccsSave: "set", game: GAME_ID, data: SAVE })');
    expect(game).toContain('localStorage.setItem(LOCAL_KEY, JSON.stringify(SAVE))');
    expect(game).not.toContain("localStorage.clear(");
    expect(W.cleanName("  Zoë  O’Neil-Ray!! ")).toBe("Zoe O'Neil-Ray");
    expect(W.cleanName("x".repeat(40))).toHaveLength(20);
    /* the pad keeps nothing */
    expect(pad).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });
});

describe("where to write", () => {
  it("a phone or tablet never gets the QR code choice; a computer gets both buttons", () => {
    expect(W.touchOnly({ coarse: true, fine: false })).toBe(true);
    expect(W.touchOnly({ coarse: true, fine: true })).toBe(false);   /* a touch laptop */
    expect(W.touchOnly({ coarse: false, fine: true })).toBe(false);
    expect(W.startChoices(true)).toEqual(["start"]);
    expect(W.startChoices(false)).toEqual(["here", "phone"]);
    expect(game).toContain('$("bPhone").hidden = c.indexOf("phone") < 0;');
    expect(game).toContain("const c = startChoices(TOUCH);");
    expect(game).toContain(">Write on this screen<");
    expect(game).toContain(">Try it on a phone or a tablet<");
    expect(game).toContain(">Start writing<");
  });
  it("the QR code shows only after \"Try it on a phone or a tablet\"", () => {
    expect(game).toMatch(/<section class="box qrpanel" id="sQR" hidden>/);
    expect(game.match(/showQRPanel\(\)/g)).toHaveLength(2);   /* its definition and the button */
    expect(game).toContain('$("bPhone").onclick = () => { sfx("click", { volume: 0.5 }); showQRPanel(); };');
    expect(game.match(/makeRoom\(\)/g)).toHaveLength(2);   /* its definition and the panel */
    expect(game.split("function showQRPanel(){")[1].split("\n}\n")[0]).toContain("makeRoom();");
    expect(game).toContain(">Back<");
    expect(game).toContain("Or go to <span id=\"joinHost\">chikescreativespace.com/write</span> and type");
  });
  it("rooms have 6-digit codes, and the pad reads them", () => {
    for (let i = 0; i < 50; i++) expect(W.roomCode(Math.random)).toMatch(/^[1-9]\d{5}$/);
    expect(W.roomCode(() => 0)).toBe("100000"); expect(W.roomCode(() => 0.9999999)).toBe("999999");
    expect(PD.readCode("482 915")).toBe("482915"); expect(PD.readCode("012345")).toBeNull(); expect(PD.readCode("12345")).toBeNull();
  });
  it("joins like Stack 'Em Up: a broadcast room, a sealed link and the key's fingerprint in the QR link", () => {
    for (const f of [game, pad]){
      expect(f).toContain('channel("writeyuna-" + code');
      expect(f).toContain('ALG: { name: "ECDH", namedCurve: "P-256" }');
      expect(f).toContain('{ name: "AES-GCM", length: 256 }');
      expect(f).toContain('loadScript("/assets/vendor/supabase.js")');
      expect(f).toContain("https://unpkg.com/@supabase/supabase-js@2.112.4/dist/umd/supabase.js");
    }
    expect(game).toContain('"/games/write-with-yuna-pad.html?room=" + NET.code + "&k=" + NET.fp');
    expect(game).toContain("https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js");
    expect(pad).toContain("if (P.fp && P.fp !== await MSC.fp(p.hk)");
    /* strokes and views travel only sealed */
    expect(game).toContain('send({ t: "you", to: NET.pad, box: await MSC.seal(key, view) })');
    expect(pad).toContain('post({ t: "s", pk: P.pk, box: await MSC.seal(P.key, m) })');
  });
  it("the pad draws only a well-formed view, and the big screen keeps only plain points from the pad", () => {
    const good = { seq: 3, phase: "trace", title: "Capital B", vb: [0, -34, 300, 204], guide: [[[0, 0], [0, 100]]], arrows: [[[1, 2], [3, 4]], null], nums: [{ n: 1, x: 0, y: 0 }], start: [0, 0] };
    expect(PD.cleanView(good)).toMatchObject({ seq: 3, phase: "trace", title: "Capital B" });
    expect(PD.cleanView(Object.assign({}, good, { phase: "hack" }))).toBeNull();
    expect(PD.cleanView(Object.assign({}, good, { guide: [[["<b>", 1]]] }))).toBeNull();
    expect(PD.cleanView(Object.assign({}, good, { vb: [0, 0, -1, 2] }))).toBeNull();
    expect(PD.cleanView({ seq: 0, phase: "wait", title: "x".repeat(99) }).title).toHaveLength(40);
    expect(W.cleanInk([[[1, 2], ["x", 3], [5, 1e9]], "bad", []], [0, -34, 300, 204])).toEqual([[[1, 2], [5, 230]]]);
    expect(W.cleanInk("nope", [0, 0, 1, 1])).toEqual([]);
  });
  it("/write forwards to the pad, keeping the room and key", () => {
    const w = read("write/index.html");
    expect(w).toContain('location.replace("/games/write-with-yuna-pad.html" + location.search)');
  });
});

describe("the look and the voice", () => {
  it("has the writing lines: blue top, thin dashed middle, red base; a thin dashed guide; the child's ink thick and blue", () => {
    for (const f of [game, pad]){
      expect(f).toContain('stroke="#1273B0"');
      expect(f).toContain('stroke="#9BB5C7"');
      expect(f).toContain('stroke="#E5484D"');
      expect(f).toContain('stroke="#1273B0" stroke-width="7" stroke-linecap="round"');   /* the child's ink */
      /* thin lines never vanish: the middle line at least 1 CSS pixel, the guide at least 1.5 */
      expect(f).toContain("Math.max(base, min / scale)");
      expect(f).not.toContain("#B9C3CB\" stroke-width=\"9\"");   /* the old big round dots are gone */
    }
    /* the dashed middle line is half the mockup's (owner, 2026-11-22) */
    expect(game).toContain('data-min="1" data-w="\' + (w * 0.3).toFixed(2)');
    expect(pad).toContain('data-min="1" data-w="0.75"');
    expect(pad).toContain('stroke-width="0.75" stroke-dasharray="5 4"');
    /* the Trace guide and the compare overlay are thin dashes (owner, 2026-11-22): 4 wide, 12 on, 9 off in the mockup's
       640-wide view (2, 6, 4.5 here); 3.5 in its 276-wide phone (1.4, 4.8, 3.6 on the pad) */
    expect(game).toContain('data-min="1.5" data-w="2" fill="none" stroke="#9AA6B0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 4.5"');
    expect(pad).toContain('data-min="1.5" data-w="1.4" fill="none" stroke="#9AA6B0" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4.8 3.6"');
    expect(game).toContain('$("gGuide").innerHTML = ph === "trace" ? guideSVG(L.strokes) : "";');
    expect(game).toContain('ph === "result" ? \'<g opacity=".95">\' + guideSVG(L.strokes)');
    expect(pad).toContain('$("gOver").innerHTML = ph === "result" ? guideSVG(v.guide) : "";');
  });
  it("calls the guide dashed, never dotted", () => {
    const copy = Object.values(W.TIPS).flatMap(t => [t.t, t.more]).concat(W.allLines());
    copy.forEach(t => expect(t).not.toMatch(/dotted/i));
    expect(game).not.toMatch(/dotted/i);
    expect(pad).not.toMatch(/dotted/i);
    expect(W.TIPS.more.more).toContain("dashed letter");
  });
  it("uses Yuna's five poses from the site's assets", () => {
    for (const p of ["wave", "point", "pencil", "thumbs-up", "cheer"]) expect(game.includes("yuna-pose-" + p + ".png") || game.includes('"' + p + '"'), p).toBe(true);
    expect(game).toContain('"/assets/characters/yuna-pose-" + p + ".png"');
    expect(game).toContain('src="/assets/characters/yuna-pose-wave.png"');
  });
  it("Watch respects reduced motion: it shows the letter already written", () => {
    expect(game).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(game).toContain("if (REDUCED || !S.length){ if (S.length) draw(S.length - 1, 1); return; }");
  });
  it("plays pre-recorded clips at the Game sounds level, and never speech synthesis", () => {
    expect(game).toContain('const VOICE_DIR = "/assets/games/write-with-yuna/voice/";');
    expect(game).toContain('CCSSound.volume("sfx")');
    expect(game).toContain('<script src="/games/game-sound.js"></script>');
    expect(game).toContain("CCSSound.button(");
    for (const f of [game, pad]) expect(f).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance/);
  });
  it("the line list for recording is the game's own, keyed the game's way, every line once", () => {
    expect(SCRIPT_LINES).toEqual(W.allLines());
    expect(scriptKey("Watch me write it.")).toBe(W.lineKey("Watch me write it."));
    expect(W.lineKey("Hi")).toBe((() => { let h = 0x811c9dc5; for (const c of "Hi"){ h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); })());
    const keys = SCRIPT_LINES.map(W.lineKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const g of W.GRADES) for (const it of W.itemsFor(g.id)) expect(SCRIPT_LINES).toContain(it.say);
    Object.values(W.FIXED).forEach(t => expect(SCRIPT_LINES).toContain(t));
    Object.values(W.TIPS).forEach(t => expect(SCRIPT_LINES).toContain(t.t));
    expect(SCRIPT_LINES.length).toBeLessThan(300);
  });
  it("every line has its recorded clip", () => {
    for (const t of SCRIPT_LINES) expect(existsSync(new URL("../assets/games/write-with-yuna/voice/" + W.lineKey(t) + ".mp3", import.meta.url)), t).toBe(true);
  });
  it("has no em dashes or emojis in any copy, and never says he or she", () => {
    const files = [game, pad, read("write/index.html"), read("scripts/yuna-lines.mjs")];
    for (const f of files){
      expect(f.includes("—")).toBe(false);
      expect(f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    const copy = W.allLines().concat(...W.GRADES.map(g => W.itemsFor(g.id).flatMap(it => [it.title, it.question, it.answer, it.done, it.sound || ""])), Object.values(W.TIPS).map(t => t.more));
    copy.forEach(t => { expect(t).not.toMatch(/\b(he|she|him|her|his|hers)\b/i); expect(t.includes("—")).toBe(false); });
  });
  it("opens on the logo loader named Write with Yuna; the pad is a remote, so it has none", () => {
    expect(game).toContain('data-name="Write with Yuna"');
    expect(pad).not.toContain('id="ccsLoad"');
  });
  it("starts at the picked child's grade", () => {
    expect(game).toContain("const CCS_CHILD_GRADE = (() => { try { const raw = window.CCS_GRADE ?? new URLSearchParams(location.search).get(\"grade\");");
    expect(game).toContain("grade: CCS_CHILD_GRADE !== null ? gradeFrom(CCS_CHILD_GRADE) : 0");
    expect(game).toContain('"Playing at " + gradeName(G.grade)');
    expect(W.GRADES.map(g => g.label + " " + g.sub)).toEqual(["K Aa to Zz", "1st Name and words", "2nd Words", "3rd Cursive", "4th Cursive", "5th Cursive"]);
  });
});
