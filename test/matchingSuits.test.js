// Matching Suits (owner's PRD, 2026-11-17; design docs/superpowers/specs/2026-11-17-matching-suits-design.md).
// The card rules live in the table screen's pure block, so they're tested here directly.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const game = readFileSync(new URL("../supabase/private-games/matching-suits.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pure = game.split("/* BEGIN pure */")[1].split("/* END pure */")[0];
const M = new Function(pure + "; return { RANKS, rankOf, suitOf, rankValue, newDeck, shuffle, seeded, deal, firstPlayer, placeHearts, startGame, legalRanks, canPass, canShuffle, reshuffle, drop, pass, botMove, standings, roomCode, playerName };")();

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

describe("playing", () => {
  it("free choice: any rank you hold; dropping takes ALL of that rank and draws just 1", () => {
    const s = fixed([["7h", "7s", "2c", "9d", "Kh"], ["3c"], ["4d"]], ["5s", "6s", "8s"]);
    expect(M.legalRanks(s, 0).sort()).toEqual(["2", "7", "9", "K"].sort());
    M.drop(s, 0, "7");
    expect(s.players[0].hand.filter(c => M.rankOf(c) === "7")).toHaveLength(0);
    expect(s.players[0].hand).toHaveLength(4);      /* 5 - 2 + 1 */
    expect(s.slots["7"]).toBe(2);
    expect(s.pile).toHaveLength(2);
    expect(s.active).toBe("7");
    expect(s.turn).toBe(1);
  });
  it("following: the next player must drop the active rank if they have it, or pass (and passing draws nothing)", () => {
    const s = fixed([["7h", "2c", "Kh"], ["7s", "3c"], ["4d", "5d"]], ["5s", "6s", "8s"]);
    M.drop(s, 0, "7");
    expect(M.legalRanks(s, 1)).toEqual(["7"]);
    expect(M.canPass(s, 1)).toBe(false);
    M.drop(s, 1, "7");
    expect(s.turn).toBe(2);
    expect(M.legalRanks(s, 2)).toEqual([]);
    expect(M.canPass(s, 2)).toBe(true);
    M.pass(s, 2);
    expect(s.players[2].hand).toHaveLength(2);
    expect(s.turn).toBe(0);
  });
  it("the 4th card flips the stack and gives a bonus turn with a free choice", () => {
    const s = fixed([["7h", "2c", "Kh"], ["7s", "7d", "7c", "3c"], ["4d"]], ["5s", "6s", "8s"]);
    M.drop(s, 0, "7");
    M.drop(s, 1, "7");
    expect(s.slots["7"]).toBe(4);
    expect(s.done["7"]).toBe(true);
    expect(s.turn).toBe(1);
    expect(s.active).toBe(null);
  });
  it("when everyone else passes back to the last dropper, the chain breaks and they choose again", () => {
    const s = fixed([["7h", "2c", "Kh"], ["3c"], ["4d"]], ["5s", "6s", "8s"]);
    M.drop(s, 0, "7");
    M.pass(s, 1); M.pass(s, 2);
    expect(s.turn).toBe(0);
    expect(s.active).toBe(null);
  });
  it("nobody can win while the pile lasts; once it's empty, the first with no cards wins and the rest rank by cards left", () => {
    const s = fixed([["7h"], ["3c", "4c"], ["4d", "5d", "6d"]], ["5s"]);
    M.drop(s, 0, "7");
    expect(s.players[0].hand).toEqual(["5s"]);
    expect(s.phase).toBe("play");
    M.pass(s, 1); M.pass(s, 2);
    M.drop(s, 0, "5");
    expect(s.phase).toBe("over");
    expect(s.winner).toBe(0);
    expect(M.standings(s).map(p => p.id)).toEqual(["p0", "p1", "p2"]);
  });
  it("refuses moves that break the rules", () => {
    const s = fixed([["7h", "2c"], ["7s", "3c"]], []);
    expect(M.drop(s, 1, "7")).toBe(false);     /* not their turn */
    expect(M.drop(s, 0, "Q")).toBe(false);     /* doesn't have it */
    expect(M.pass(s, 0)).toBe(false);          /* free choice can't pass */
    M.drop(s, 0, "7");
    expect(M.drop(s, 1, "3")).toBe(false);     /* must follow the 7s */
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
  it("follow the active rank when they can, and pass when they can't", () => {
    const s = fixed([["7h", "2c", "Kh"], ["7s", "3c"], ["4d"]], ["5s", "6s"]);
    M.drop(s, 0, "7");
    expect(M.botMove(s, 1)).toEqual({ t: "drop", rank: "7" });
    M.drop(s, 1, "7");
    expect(M.botMove(s, 2)).toEqual({ t: "pass" });
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

describe("joining", () => {
  it("room codes are 4 letters without I or O", () => {
    for (let i = 0; i < 200; i++) expect(M.roomCode(M.seeded(i))).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });
  it("a player with no name is Player #N, where N is their seat", () => {
    expect(M.playerName("", 1)).toBe("Player #2");
    expect(M.playerName("  Maya  ", 0)).toBe("Maya");
    expect(M.playerName("A very very long name indeed", 0)).toBe("A very very long");
  });
});

describe("the table screen", () => {
  it("never stalls while hidden: card moves finish at once when the browser pauses animation", () => {
    expect(game).toContain("setInterval(() => { if (document.hidden && MOVES.length) finishMoves(); }, 250);");
  });
  it("has the logo loading screen, Chike in the corner, and robots", () => {
    expect(game).toContain('data-name="Matching Suits"');
    expect(game).toContain('id="chikeImg"');
    expect(game).toContain('const ROBOTS = ["Robo", "Bolt", "Sprocket", "Gizmo"];');
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
  it("lets each player reshuffle once from their device", () => {
    expect(game).toContain('if (p.t === "shuffle" && G.phase === "play") doShuffle(i);');
    expect(game).toContain("canShuffle: st ? canShuffle(st, i) && !G.busy : false");
  });
  it("sends each player only their own hand", () => {
    const tell = game.split("function tell(i){")[1].split("\n}\n")[0];
    expect(tell).toContain("pid: s.pid");
    expect(tell).toContain("hand: me ? me.hand.slice()");
  });
});

describe("the pages", () => {
  it("the controller page and the short join address exist", () => {
    expect(existsSync(new URL("../games/matching-suits-player.html", import.meta.url))).toBe(true);
    expect(readFileSync(new URL("../join/index.html", import.meta.url), "utf8")).toContain("/games/matching-suits-player.html");
  });
  it("the controller has a Shuffle button that works only when the table allows it", () => {
    const player = readFileSync(new URL("../games/matching-suits-player.html", import.meta.url), "utf8");
    expect(player).toContain('id="bShuffle"');
    expect(player).toContain('$("bShuffle").disabled = !can || !v.canShuffle;');
    expect(player).toContain('send({ t: "shuffle" })');
  });
});
