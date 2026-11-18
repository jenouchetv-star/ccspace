// Matching Suits (owner's PRD, 2026-11-17; design docs/superpowers/specs/2026-11-17-matching-suits-design.md).
// The card rules live in the table screen's pure block, so they're tested here directly.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/matching-suits.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = game.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const M = new Function(pure + "; return { RANKS, rankOf, suitOf, rankValue, newDeck, shuffle, seeded, deal, firstPlayer, placeHearts, startGame, legalRanks, onTable, startsNew, canPass, canShuffle, reshuffle, drop, pass, botMove, standings, roomCode, playerName };")();

/* a game with chosen hands, for exact checks */
function fixed(hands, pile){
  const s = M.startGame(hands.map((_, i) => ({ id: "p" + i, name: "P" + i })), M.seeded(1));
  s.players.forEach((p, i) => { p.hand = hands[i].slice(); });
  s.pile = pile.slice();
  s.slots = Object.fromEntries(M.RANKS.map(r => [r, 0]));
  s.done = {};
  s.turn = 0; s.active = null; s.lastDropper = null; s.phase = "play"; s.winner = null;
  return s;
}

describe("the deck and the deal", () => {
  it("is 52 different cards", () => {
    const d = M.newDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d).size).toBe(52);
    expect(d).toContain("10h"); expect(d).toContain("As"); expect(d).toContain("Kc");
  });
  it("deals 5 cards to each player and leaves the rest in the pile (32, 37 or 42)", () => {
    for (const [n, left] of [[4, 32], [3, 37], [2, 42]]){
      const { hands, pile } = M.deal(n, M.seeded(n));
      expect(hands).toHaveLength(n);
      hands.forEach(h => expect(h).toHaveLength(5));
      expect(pile).toHaveLength(left);
      expect(new Set(hands.flat().concat(pile)).size).toBe(52);
    }
  });
  it("ranks Ace low and King high", () => {
    expect(M.rankValue("A")).toBe(1); expect(M.rankValue("10")).toBe(10); expect(M.rankValue("K")).toBe(13);
    expect(M.rankOf("10d")).toBe("10"); expect(M.suitOf("10d")).toBe("d");
  });
});

describe("the Heart Race", () => {
  it("the highest heart goes first", () => {
    expect(M.firstPlayer([["9h", "2c"], ["Qh", "Ks"], ["4h"]])).toBe(1);
  });
  it("hearts beat higher cards of other suits", () => {
    expect(M.firstPlayer([["Ks", "Kd"], ["2h"]])).toBe(1);
  });
  it("with no hearts anywhere, the highest card goes first, then spades, hearts, diamonds, clubs", () => {
    expect(M.firstPlayer([["9s", "2c"], ["Jd"], ["4c"]])).toBe(1);
    expect(M.firstPlayer([["Kc"], ["Ks"]])).toBe(1);
    expect(M.firstPlayer([["Kd"], ["Kc"]])).toBe(0);
  });
});

describe("after the Heart Race (owner, 2026-11-17)", () => {
  it("every player's highest heart stays on the table on its slot, and each of them draws a card", () => {
    const s = fixed([["9h", "2h", "Kc"], ["Qh", "3c"], ["4d", "5d"]], ["5s", "6s", "8s"]);
    const placed = M.placeHearts(s);
    expect(placed.map(x => x.card)).toEqual(["9h", "Qh"]);
    expect(s.slots["9"]).toBe(1); expect(s.slots["Q"]).toBe(1); expect(s.slots["2"]).toBe(0);
    expect(s.players[0].hand).toEqual(["2h", "Kc", "8s"]);
    expect(s.players[1].hand).toEqual(["3c", "6s"]);
    expect(s.players[2].hand).toEqual(["4d", "5d"]);   /* no hearts: nothing put down, nothing drawn */
    expect(s.pile).toEqual(["5s"]);
  });
});

describe("playing: match the table (owner, 2026-11-17)", () => {
  it("you may drop any rank you hold that's already on the table, not just the last one played", () => {
    const s = fixed([["7h", "9s", "2c", "Kh"], ["3c"]], ["5s", "6s", "8s"]);
    s.slots["7"] = 1; s.slots["9"] = 2; s.slots["Q"] = 1;
    expect(M.legalRanks(s, 0)).toEqual(["7", "9"]);
    expect(M.onTable(s)).toEqual(["7", "9", "Q"]);
    expect(M.startsNew(s, 0)).toBe(false);
  });
  it("when nothing matches the table, you start a new rank with any card", () => {
    const s = fixed([["2c", "Kh", "Kd"], ["3c"]], ["5s", "6s", "8s"]);
    s.slots["7"] = 1;
    expect(M.legalRanks(s, 0)).toEqual(["2", "K"]);
    expect(M.startsNew(s, 0)).toBe(true);
    const ev = M.drop(s, 0, "K");
    expect(ev.started).toBe(true);
    expect(s.slots["K"]).toBe(2);
  });
  it("you can't start a new rank while you hold a match", () => {
    const s = fixed([["7h", "2c"], ["3c"]], ["5s"]);
    s.slots["7"] = 1;
    expect(M.drop(s, 0, "2")).toBe(false);
    expect(M.drop(s, 0, "7")).toBeTruthy();
  });
  it("dropping takes ALL of that rank, draws just 1, and the turn moves on", () => {
    const s = fixed([["7h", "7s", "2c", "9d", "Kh"], ["3c"], ["4d"]], ["5s", "6s", "8s"]);
    s.slots["7"] = 1;
    M.drop(s, 0, "7");
    expect(s.players[0].hand.filter(c => M.rankOf(c) === "7")).toHaveLength(0);
    expect(s.players[0].hand).toHaveLength(4);      /* 5 - 2 + 1 */
    expect(s.slots["7"]).toBe(3);
    expect(s.pile).toHaveLength(2);
    expect(s.turn).toBe(1);
  });
  it("nobody ever passes: there is always something to drop", () => {
    const s = fixed([["7h", "2c"], ["3c"]], ["5s"]);
    expect(M.canPass(s, 0)).toBe(false);
    expect(M.pass(s, 0)).toBe(false);
    for (let seed = 1; seed <= 30; seed++){
      const g = M.startGame([0, 1, 2].map(i => ({ id: "b" + i, name: "R" + i, bot: true })), M.seeded(seed));
      M.placeHearts(g); g.phase = "play";
      while (g.phase === "play"){ expect(M.legalRanks(g, g.turn).length, "seed " + seed).toBeGreaterThan(0); M.drop(g, g.turn, M.botMove(g, g.turn).rank); }
    }
  });
  it("the 4th card flips the stack and gives a bonus turn", () => {
    const s = fixed([["7h", "2c", "Kh"], ["7s", "7d", "7c", "3c"], ["4d"]], ["5s", "6s", "8s"]);
    M.drop(s, 0, "7");
    M.drop(s, 1, "7");
    expect(s.slots["7"]).toBe(4);
    expect(s.done["7"]).toBe(true);
    expect(s.turn).toBe(1);
  });
  it("flipping a full set of 4 does not draw a card from the pile (owner, 2026-11-18)", () => {
    const s = fixed([["7h", "2c", "Kh"], ["7s", "7d", "7c", "3c"], ["4d"]], ["5s", "6s", "8s"]);
    M.drop(s, 0, "7");
    expect(s.pile).toHaveLength(2);                  /* a normal drop still draws */
    const ev = M.drop(s, 1, "7");
    expect(ev.complete).toBe(true);
    expect(ev.drew).toBe(null);
    expect(s.players[1].hand).toEqual(["3c"]);
    expect(s.pile).toEqual(["5s", "6s"]);
  });
  it("flipping a set with your last cards wins, even with cards left in the pile", () => {
    const s = fixed([["7h", "2c"], ["7s", "7d", "7c"], ["4d"]], ["5s", "6s", "8s"]);
    M.drop(s, 0, "7");
    const ev = M.drop(s, 1, "7");
    expect(ev.win).toBe(true);
    expect(s.winner).toBe(1);
    expect(s.pile).toHaveLength(2);
  });
  it("nobody can win while the pile lasts; once it's empty, the first with no cards wins and the rest rank by cards left", () => {
    const s = fixed([["7h"], ["3c", "4c"], ["4d", "5d", "6d"]], ["5s"]);
    M.drop(s, 0, "7");
    expect(s.players[0].hand).toEqual(["5s"]);
    expect(s.phase).toBe("play");
    M.drop(s, 1, "3"); M.drop(s, 2, "4");
    M.drop(s, 0, "5");
    expect(s.phase).toBe("over");
    expect(s.winner).toBe(0);
    expect(M.standings(s).map(p => p.id)).toEqual(["p0", "p1", "p2"]);
  });
  it("refuses moves that break the rules", () => {
    const s = fixed([["7h", "2c"], ["7s", "3c"]], []);
    expect(M.drop(s, 1, "7")).toBe(false);     /* not their turn */
    expect(M.drop(s, 0, "Q")).toBe(false);     /* doesn't have it */
    M.drop(s, 0, "7");
    expect(M.drop(s, 1, "3")).toBe(false);     /* must match the 7s on the table */
  });
});

describe("fair play under match the table (owner asked, 2026-11-17: will the first player win every time?)", () => {
  it("the Heart Race winner wins about their fair share, not every time", () => {
    for (const n of [2, 3, 4]){
      let firstWins = 0, games = 0;
      for (let seed = 1; seed <= 1500; seed++){
        const g = M.startGame(Array.from({ length: n }, (_, i) => ({ id: "b" + i, name: "R" + i, bot: true })), M.seeded(seed * 7 + n));
        M.placeHearts(g); g.phase = "play"; const first = g.turn;
        while (g.phase === "play") M.drop(g, g.turn, M.botMove(g, g.turn).rank);
        games++; if (g.winner === first) firstWins++;
      }
      const share = firstWins / games;
      expect(share, n + " players").toBeGreaterThan(1 / n - .08);
      expect(share, n + " players").toBeLessThan(1 / n + .08);
    }
  });
});

describe("reshuffling (owner, 2026-11-17: each player can reshuffle the draw deck once)", () => {
  it("on your turn, once a game, while the deck has 2 or more cards; it doesn't use up your turn", () => {
    const s = fixed([["7h", "2c"], ["3c", "4c"]], ["5s", "6s", "8s", "9s", "Ks"]);
    expect(M.canShuffle(s, 1)).toBe(false);            /* not their turn */
    expect(M.canShuffle(s, 0)).toBe(true);
    expect(M.reshuffle(s, 0, M.seeded(3))).toBe(true);
    expect(s.pile.slice().sort()).toEqual(["5s", "6s", "8s", "9s", "Ks"].sort());
    expect(s.turn).toBe(0);
    expect(M.canShuffle(s, 0)).toBe(false);            /* once */
    expect(M.reshuffle(s, 0, M.seeded(4))).toBe(false);
    M.drop(s, 0, "7");
    expect(M.canShuffle(s, 1)).toBe(true);             /* everyone gets their own */
  });
  it("not with fewer than 2 cards in the deck", () => {
    const s = fixed([["7h", "2c"], ["3c"]], ["5s"]);
    expect(M.canShuffle(s, 0)).toBe(false);
  });
});

describe("robots", () => {
  it("match the table when they can, and start a new rank when they can't; they never pass", () => {
    const s = fixed([["7h", "2c", "Kh"], ["7s", "3c"], ["4d"]], ["5s", "6s"]);
    M.drop(s, 0, "7");
    expect(M.botMove(s, 1)).toEqual({ t: "drop", rank: "7" });
    M.drop(s, 1, "7");
    expect(M.botMove(s, 2)).toEqual({ t: "drop", rank: "4" });
  });
  it("with a free choice, finish a stack if they can, or else drop their biggest group", () => {
    const s = fixed([["9h", "9s", "Kh", "Jc"], ["3c"]], ["5s"]);
    s.slots["K"] = 3;
    expect(M.botMove(s, 0)).toEqual({ t: "drop", rank: "K" });
    s.slots["K"] = 0;
    expect(M.botMove(s, 0)).toEqual({ t: "drop", rank: "9" });
  });
  it("a whole game of robots always finishes with a winner", () => {
    for (let seed = 1; seed <= 40; seed++){
      const s = M.startGame([1, 2, 3, 4].slice(0, 2 + seed % 3).map(i => ({ id: "b" + i, name: "Robo " + i, bot: true })), M.seeded(seed));
      M.placeHearts(s); s.phase = "play";
      let moves = 0;
      while (s.phase === "play" && moves < 2000){ const m = M.botMove(s, s.turn); if (m.t === "drop") M.drop(s, s.turn, m.rank); else M.pass(s, s.turn); moves++; }
      expect(s.phase, "seed " + seed).toBe("over");
      expect(s.players[s.winner].hand).toHaveLength(0);
    }
  });
});

describe("computer players (owner, 2026-11-17: character names, picked at random)", () => {
  const src = "const CHARACTERS = " + game.split("const CHARACTERS = ")[1].split("function computerName(")[0] + "function computerName(" + game.split("function computerName(")[1].split("\n}\n")[0] + "\n}\n";
  const names = new Function(src + "return computerName;")();
  it("are Chike and friends, never two with the same name, and never a name a person already took", () => {
    const seats = [{ name: "Zech" }];
    for (let k = 0; k < 3; k++) seats.push({ name: names(seats, Math.random) });
    expect(new Set(seats.map(s => s.name)).size).toBe(4);
    seats.slice(1).forEach(s => expect(["Chike", "Yuna", "Kiyah", "Mateo", "Corey", "Averi", "Stacey"]).toContain(s.name));
  });
  it("change from game to game", () => {
    const seen = new Set();
    for (let k = 0; k < 40; k++) seen.add(names([], Math.random));
    expect(seen.size).toBeGreaterThan(4);
  });
});

describe("joining", () => {
  it("room codes are 4 letters without I or O", () => {
    for (let i = 0; i < 200; i++) expect(M.roomCode(M.seeded(i))).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });
  it("on your own device you are \"You\"; on the big screen too, when it's just you and the computer", () => {
    const player = readFileSync(new URL("../games/matching-suits-player.html", import.meta.url), "utf8");
    expect(player).toContain('$("who").textContent = "You";');
    expect(game).toContain('esc(s.local && !phonesHere() ? "You" : s.name)');
    expect(game).toContain('phonesHere() ? v.name + "\'s cards" : "Your cards"');
  });
  it("a player with no name is Player N, where N is their seat (owner, 2026-11-17)", () => {
    expect(M.playerName("", 1)).toBe("Player 2");
    expect(M.playerName("  Maya  ", 0)).toBe("Maya");
    expect(M.playerName("A very very long name indeed", 0)).toBe("A very very long");
  });
});

describe("the table screen", () => {
  it("never stalls while hidden: card moves finish at once when the browser pauses animation", () => {
    expect(game).toContain("setInterval(() => { if (document.hidden && MOVES.length) finishMoves(); }, 250);");
  });
  it("has the logo loading screen, Chike in the corner, and robots", () => {
    expect(game).toContain('data-name="Stack &#39;Em Up!"');   /* the game's name since 2026-11-17 (was Matching Suits) */
    expect(game).toContain('id="chikeImg"');
    expect(game).toContain('const CHARACTERS = ["Chike", "Zech", "Yuna", "Kiyah", "Mateo", "Corey", "Averi", "Stacey"];');
    /* a player at each corner of the table (owner) */
    expect(game).toContain("const SEAT_SPOTS = { 2: [C_FL, C_BR], 3: [C_FL, C_BL, C_BR], 4: [C_FL, C_BL, C_BR, C_FR] };");
  });
  it("spotlights the player whose turn it is and dims everyone else's cards (owner, 2026-11-17)", () => {
    const paint = game.split("function paintTurn(dt){")[1].split("\n}\n")[0];
    expect(paint).toContain('who = st && st.phase === "play" ? st.turn : -1');
    expect(paint).toContain("turnSpot.intensity = spotOn * 70");
    expect(paint).toContain("(who >= 0 && who !== i) ? 1 : 0");
    expect(game).toMatch(/stepMoves\(dt\);\s*paintTurn\(dt\);/);
  });
  it("card backs never turn black in the site's sealed frame: the logo is asked for with CORS, and only a readable copy is used (owner, 2026-11-17)", () => {
    expect(game).toContain('const logo = new Image(); logo.crossOrigin = "anonymous"; logo.src = "/assets/brand/logo.webp";');
    expect(game).toContain("try { g.getImageData(0, 0, 1, 1); } catch (_e) { return; }");
    expect(game).not.toMatch(/backTex\.image\.getContext\("2d"\)/);
  });
  it("lets each player reshuffle once from their device", () => {
    expect(game).toContain('if (p.t === "shuffle" && G.phase === "play") doShuffle(i);');
    expect(game).toContain("canShuffle: st ? canShuffle(st, i) && !G.busy : false");
  });
  it("sends each player only their own hand, sealed so only their device can read it (security review)", () => {
    const tell = game.split("function tell(i){")[1].split("\n}\n")[0];
    expect(tell).toContain("sealTo(s, Object.assign({ v: ++s.out }, viewFor(i)));");
    expect(tell).not.toContain("send(");
    const view = game.split("function viewFor(i){")[1].split("\n}\n")[0];
    expect(view).toContain("hand: me ? me.hand.slice()");
    expect(game).toContain('send({ t: "you", to: s.pk, box: await MSC.seal(key, view) })');
  });
  it("only acts on sealed moves it can open, and never the same one twice", () => {
    const on = game.split("async function onMsg(p){")[1].split("\n}\n")[0];
    expect(on).toContain('if (p.t !== "s" || !p.box) return;');
    expect(on).toContain("const m = await MSC.open(key, p.box);");
    expect(on).toContain("!(Number(m.n) > (NET.lastN[p.pk] || 0))");
  });
});

describe("playing on this screen (owner, 2026-11-17: play against the robots without a phone)", () => {
  it("the lobby has a Play on this screen button that seats one player at the table itself", () => {
    expect(game).toContain('<button class="btn sun wide" id="bHere" type="button">+ Play on this screen</button>');
    expect(game).toContain('G.seats.push({ id: "here", name: playerName($("hereName").value, i), bot: false, local: true });');
    expect(game).toContain("if (G.phase !== \"lobby\" || hereSeat() >= 0 || G.seats.length >= 4) return;");
  });
  it("the screen player's cards go to the tray on this screen, never over the network", () => {
    const tell = game.split("function tell(i){")[1].split("\n}\n")[0];
    expect(tell.indexOf("if (s.local) return paintTray();")).toBeLessThan(tell.indexOf("sealTo("));
  });
  it("the tray plays by the same rules: Drop, Pass, Shuffle and the Heart Race go through the table's own moves", () => {
    expect(game).toContain('act(i, { t: "drop", rank });');
    expect(game).toContain('act(i, { t: "pass" });');
    expect(game).toContain('$("tShuffle").onclick = () => { const i = hereSeat(); if (i >= 0) doShuffle(i); };');
    expect(game).toContain("reveal(i); } };");
  });
  it("with friends on phones too, the tray hides the cards until tapped, and hides them again each turn", () => {
    expect(game).toContain("const covered = phonesHere() && !HERE.peek;");
    expect(game).toMatch(/function turnStarted\(\)\{\n\s+const st = G\.state, i = st\.turn, name = st\.players\[i\]\.name;\n\s+HERE\.peek = false;/);
  });
});

describe("restarting from a phone (owner, 2026-11-18: any live player can restart the game from their device)", () => {
  const player = readFileSync(new URL("../games/matching-suits-player.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const R = new Function(pure + "; return canRestart;")();
  it("a seated person can restart once the game has begun; a computer player, a stranger or the lobby can't", () => {
    for (const ph of ["race", "draw", "play", "over"]) expect(R(ph, { pk: "x", bot: false }), ph).toBe(true);
    expect(R("lobby", { pk: "x", bot: false })).toBe(false);
    expect(R("play", { id: "bot1", bot: true })).toBe(false);
    expect(R("play", undefined)).toBe(false);
  });
  it("the table deals a fresh round for the same players when a phone asks", () => {
    expect(game).toContain('if (p.t === "restart" && canRestart(G.phase, G.seats[i])) restartFrom(i);');
    const fn = game.split("function restartFrom(i){")[1].split("\n}\n")[0];
    expect(fn).toContain("startRound(");
    expect(fn).toContain("restarted the game");
  });
  it("a restart stops the old round's moves: every waiting step checks the round is still the same one", () => {
    expect(game).toMatch(/function startRound\([^)]*\)\{\n\s+G\.round\+\+;/);
    const act = game.split("async function act(i, move){")[1].split("\n}\n")[0];
    expect((act.match(/if \(G\.round !== r\) return;/g) || []).length).toBeGreaterThanOrEqual(3);
    const race = game.split("async function finishRace(){")[1].split("\n}\n")[0];
    expect((race.match(/if \(G\.round !== r\) return;/g) || []).length).toBeGreaterThanOrEqual(3);
    const shuf = game.split("async function doShuffle(i){")[1].split("\n}\n")[0];
    expect(shuf).toContain("if (G.round !== r) return;");
  });
  it("the phone has a Restart button that asks first, then sends the restart", () => {
    expect(player).toContain('id="bRestart"');
    expect(player).toContain('id="restartAsk"');
    expect(player).toContain('send({ t: "restart" });');
  });
});

describe("the riffle shuffle (owner's pick, 2026-11-17)", () => {
  const R = new Function(pure + "; return riffle;")();
  it("cards fall one at a time from each half, alternating, and none are lost", () => {
    expect(R(["a", "b", "c"], ["x", "y", "z"])).toEqual(["a", "x", "b", "y", "c", "z"]);
    expect(R(["a", "b", "c"], ["x", "y"])).toEqual(["a", "x", "b", "y", "c"]);
    expect(R([], ["x"])).toEqual(["x"]);
  });
  it("the table splits the deck into two tilted halves, then riffles them together", () => {
    expect(game).toContain("const order = riffle(all.slice(0, half), all.slice(half))");
    expect(game).toContain("new THREE.Euler(0, left ? .1 : -.1, left ? -.16 : .16)");
  });
});

describe("private links (security review, 2026-11-17)", () => {
  const player = readFileSync(new URL("../games/matching-suits-player.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const mscOf = (src) => new Function(src.split("const MSC = {")[1].split("\n};\n")[0].replace(/^/, "const MSC = {") + "\n};\nreturn MSC;")();
  it("the table and the device share the same sealing code", () => {
    expect(game.split("const MSC = {")[1].split("\n};\n")[0]).toBe(player.split("const MSC = {")[1].split("\n};\n")[0]);
  });
  it("a sealed message opens with the shared key, and not with anyone else's", async () => {
    const MSC = mscOf(game);
    const table = await MSC.pair(), phone = await MSC.pair(), other = await MSC.pair();
    const k1 = await MSC.key(table.privateKey, await MSC.pub(phone)), k2 = await MSC.key(phone.privateKey, await MSC.pub(table));
    const box = await MSC.seal(k1, { hand: ["7h", "Ks"] });
    expect(await MSC.open(k2, box)).toEqual({ hand: ["7h", "Ks"] });
    const k3 = await MSC.key(other.privateKey, await MSC.pub(table));
    expect(await MSC.open(k3, box)).toBe(null);
    const bad = { iv: box.iv, d: box.d.slice(0, -4) + (box.d.slice(-4) === "AAAA" ? "BBBB" : "AAAA") };
    expect(await MSC.open(k2, bad)).toBe(null);
  });
  it("the QR link carries the table key's fingerprint, and a scanning device trusts only that table", async () => {
    const MSC = mscOf(game), kp = await MSC.pair(), pk = await MSC.pub(kp), fp = await MSC.fp(pk);
    expect(fp).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(await MSC.fp(pk)).toBe(fp);
    expect(await MSC.fp(await MSC.pub(await MSC.pair()))).not.toBe(fp);
    expect(game).toContain('?room=" + G.code + "&k=" + NET.fp');
    expect(player).toContain('if (P.fp && P.fp !== await MSC.fp(p.hk).catch(() => "")) return;');
  });
  it("the device draws only well-formed cards and numbers, and sends nothing in the clear but its public key", () => {
    expect(player).toContain("const CARD_RE = /^(A|[2-9]|10|J|Q|K)[hdcs]$/;");
    expect(player).toContain("const v = cleanView(m); if (v) paint(v);");
    expect(player).not.toMatch(/\bpid\b/);
    expect(player).toContain('post({ t: "s", pk: P.pk, box: await MSC.seal(P.key, m) });');
  });
});

describe("the pages", () => {
  it("the controller page and the short join address exist", () => {
    expect(existsSync(new URL("../games/matching-suits-player.html", import.meta.url))).toBe(true);
    expect(readFileSync(new URL("../join/index.html", import.meta.url), "utf8")).toContain("/games/matching-suits-player.html");
  });
  it("the phone shows the whole table: all 13 slots, cards down, finished ranks, and the ranks you can drop (owner, 2026-11-17)", () => {
    const player = readFileSync(new URL("../games/matching-suits-player.html", import.meta.url), "utf8");
    expect(game).toContain("slots: st ? RANKS.map(r => st.slots[r]) : [], done: st ? RANKS.filter(r => st.done[r]) : [],");
    expect(player).toContain('<div class="felt" id="tableBox" role="group" aria-label="The cards on the table">');
    expect(player).toContain("const n = v.slots[k] || 0, done = v.done.includes(r), can = mine && !v.busy && v.legal.includes(r);");
    expect(player).toContain("if (slots.length && slots.length !== 13) return null;");
  });
  it("the controller has a Shuffle button that works only when the table allows it", () => {
    const player = readFileSync(new URL("../games/matching-suits-player.html", import.meta.url), "utf8");
    expect(player).toContain('id="bShuffle"');
    expect(player).toContain('$("bShuffle").disabled = !can || !v.canShuffle;');
    expect(player).toContain('send({ t: "shuffle" })');
  });
});
