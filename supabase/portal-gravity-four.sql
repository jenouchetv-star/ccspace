-- Chike's Creative Space - add the members-only game "Chike's Gravity Four"
--
-- Run in the Supabase SQL Editor AFTER supabase/newsletter-portal.sql (it needs the portal_game_files
-- table). Safe to run again: it refreshes the game's code and never overwrites an entry you have edited.
--
-- It does two things:
--   1. stores the game's code in portal_game_files (admin-only; nobody can open it as a page), and
--   2. adds a DRAFT entry in the Newsletter portal for you to review: add a cover picture, then Publish.
--
-- The game's source is supabase/private-games/chikes-gravity-four.html. That folder is not part of the
-- deployed site (see .assetsignore), so the game has no public address. Regenerate this file after
-- changing the game with: node supabase/build-private-game-sql.cjs

insert into portal_game_files (id, data)
values ('gravity-four', jsonb_build_object('html', $g4code$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Chike's Gravity Four</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap">
<style>
/* Chike's Creative Space brand tokens (same values as the site and the other games) */
:root{
  --ink:#1E2226; --paper:#FAF4E6; --card:#FFFBF3; --slate:#1B2A32;
  --sun:#F5B921; --cyan:#17B3CE; --blue:#1273B0; --plum:#7A4A86; --mut:#5B6670; --bad:#BC3229;
  --hard:4px 4px 0 #1E2226;
}
*{box-sizing:border-box}
html,body{height:100%;margin:0;overflow:hidden}
body{
  font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-weight:500;color:var(--ink);
  -webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none;
  background-color:var(--paper);
  background-image:radial-gradient(circle at center,rgba(30,52,62,.09) 1px,transparent 1.2px),linear-gradient(180deg,#E2EDEF 0%,#EEF4F3 28%,#FAF4E6 68%,#FDF8EC 100%);
  background-size:7px 7px,100% 100%;
}
[hidden]{display:none!important}
h1,h2,h3,p{margin:0}
h1,h2,h3{font-weight:800;letter-spacing:-.028em;line-height:1.08}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

#gl{position:fixed;inset:0}
#gl canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}
#gl canvas:focus-visible{outline:3px solid var(--ink);outline-offset:-6px;box-shadow:inset 0 0 0 9px var(--sun)}

/* ---- cards and buttons: the site's ink outline and hard shadow ---- */
.card{background:var(--card);border:3px solid var(--ink);border-radius:18px;box-shadow:var(--hard)}
button{font:inherit;font-weight:800;color:var(--ink);background:var(--card);border:3px solid var(--ink);border-radius:999px;
  box-shadow:var(--hard);min-height:46px;padding:8px 20px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  transition:transform .13s cubic-bezier(.2,.9,.3,1.4),box-shadow .13s}
button:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}
button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
button:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:var(--hard)}
button.sun{background:var(--sun)} button.cy{background:var(--cyan)}
button.blue{background:var(--blue);color:#fff}
button.sq{width:46px;padding:0;border-radius:14px}
:focus-visible{outline:3px solid var(--ink)!important;outline-offset:2px;box-shadow:0 0 0 6px var(--sun)!important}
.ico{width:1.3em;height:1.3em;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;flex:none}

/* ---- heads-up display ---- */
.hud{position:fixed;left:0;right:0;display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;
  padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 0 max(12px,env(safe-area-inset-left));pointer-events:none;z-index:2}
.hud>*{pointer-events:auto}
.hud.bot{top:auto;bottom:0;align-items:flex-end;padding:0 max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
.brand{display:flex;align-items:center;gap:10px;padding:6px 16px 6px 8px}
.badge{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--sun);border:3px solid var(--ink);font-weight:800;font-size:.95rem}
.brand b{font-size:clamp(.95rem,2.4vw,1.2rem);letter-spacing:-.02em;font-weight:800}
.brand small{display:block;color:var(--mut);font-weight:700;font-size:.74rem;margin-top:1px}
.turn{display:flex;align-items:center;gap:10px;padding:7px 16px 7px 9px;font-weight:800}
.dot{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:3px solid var(--ink);font-weight:800;font-size:.85rem;flex:none}
.dot.p1{background:var(--cyan)} .dot.p2{background:var(--sun)}
.msg{flex-basis:100%;display:flex;justify-content:center;pointer-events:none}
.msg p{pointer-events:auto;background:var(--ink);color:#fff;border-radius:999px;padding:5px 16px;font-weight:700;font-size:.9rem;max-width:min(560px,92vw);text-align:center}
.msg p.bad{background:var(--bad)}
.score{display:flex;align-items:center;gap:14px;padding:8px 18px}
.score .side{display:flex;align-items:center;gap:9px}
.score .who{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);line-height:1.1}
.score .n{font-size:1.5rem;font-weight:800;line-height:1}
.score .vs{font-weight:800;color:var(--mut)}
.pad{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
.pad .drop{min-width:150px}

/* ---- menus ---- */
.scrim{position:fixed;inset:0;z-index:5;display:grid;place-items:center;padding:16px;background:rgba(30,34,38,.34);
  -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);overflow:auto}
.sheet{width:min(460px,100%);padding:clamp(18px,4vh,28px);text-align:center;position:relative}
.sheet h2{font-size:clamp(1.55rem,5vw,2rem);margin-bottom:12px}
.sheet .lede{color:var(--mut);font-weight:600;margin-bottom:26px}
.chip{display:inline-block;background:var(--plum);color:#fff;border:3px solid var(--ink);border-radius:999px;padding:1px 14px;font-size:.88rem;font-weight:800;box-shadow:2px 2px 0 var(--ink);margin-bottom:16px}
.mode{display:flex;align-items:center;gap:14px;width:100%;text-align:left;border-radius:18px;padding:12px 16px;margin-bottom:18px}
.mode .ico{width:1.7em;height:1.7em}
.mode .face{flex:none;display:block;width:52px;height:52px}
.mode .face img{display:block;width:100%;height:100%}
.mode b{display:block;font-size:1.05rem}
.mode span{display:block;font-weight:600;font-size:.84rem;color:var(--mut)}
#mAi{background:var(--blue);color:#fff}
#mAi span{color:#fff}
.levels{display:flex;gap:8px;justify-content:center;margin:0 0 26px}
.levels button{min-height:38px;padding:4px 16px;font-size:.88rem;box-shadow:2px 2px 0 var(--ink)}
.levels button[aria-pressed="true"]{background:var(--sun)}
.field{background:#fff;border:3px solid var(--ink);border-radius:12px;font:inherit;font-weight:800;color:var(--ink);text-align:center;letter-spacing:.35em;
  font-size:1.35rem;min-height:50px;width:100%;padding:6px 10px;-webkit-user-select:text;user-select:text}
.field::placeholder{letter-spacing:.05em;font-weight:600;color:#8a949c;font-size:1rem}
.box{background:#fff;border:3px solid var(--ink);border-radius:16px;padding:14px;text-align:left;margin-bottom:12px}
.box label{display:block;font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;font-weight:800;margin-bottom:8px}
.row{display:flex;gap:10px}
.code{font-size:clamp(2rem,9vw,2.8rem);font-weight:800;letter-spacing:.2em;padding:10px 0 10px .2em;background:#fff;border:3px solid var(--ink);border-radius:16px;margin:8px 0 14px;-webkit-user-select:all;user-select:all}
.err{color:var(--bad);font-weight:800;font-size:.9rem;min-height:1.3em;margin:0 0 10px}
.back{position:absolute;top:14px;left:14px;min-height:40px;padding:4px 12px;font-size:.85rem}
.big{display:grid;place-items:center;width:78px;height:78px;border-radius:50%;margin:0 auto 12px;border:3px solid var(--ink);font-size:2.2rem;font-weight:800;box-shadow:var(--hard)}
.stack>button{width:100%;margin-bottom:12px}
.stack>button:last-child{margin-bottom:0}
.dots::after{content:"";animation:dots 1.4s steps(4,end) infinite}
@keyframes dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
#nogl{position:fixed;inset:0;z-index:6;display:grid;place-items:center;padding:20px}

@media (max-width:560px){
  .brand small{display:none}
  .pad .drop{min-width:0}
  .score{gap:10px;padding:6px 12px}
  .hud.bot{flex-direction:column;align-items:stretch}
  .pad{justify-content:center}
  .score{justify-content:center}
}
@media (max-height:520px){ .brand small{display:none} .sheet{padding:14px} .mode{padding:8px 12px;margin-bottom:8px} }
@media (prefers-reduced-motion:reduce){ button{transition:none} .dots::after{animation:none;content:"..."} }
</style>
</head>
<body>

<div id="gl"></div>

<header class="hud" id="hudTop">
  <div class="card brand">
    <span class="badge" aria-hidden="true">G4</span>
    <div><b>Chike&rsquo;s Gravity Four</b><small>Line up four chips in a row</small></div>
  </div>
  <div class="card turn" id="turn" aria-hidden="true"><span class="dot p1" id="turnDot">O</span><span id="turnText">Your turn</span></div>
  <div class="msg"><p id="note" hidden></p></div>
</header>

<footer class="hud bot" id="hudBot" hidden>
  <div class="card score" aria-label="Score">
    <div class="side"><span class="dot p1">O</span><div><div class="who" id="n1">You</div><div class="n" id="s1">0</div></div></div>
    <span class="vs">VS</span>
    <div class="side"><div style="text-align:right"><div class="who" id="n2">Chike</div><div class="n" id="s2">0</div></div><span class="dot p2">X</span></div>
  </div>
  <div class="pad">
    <button type="button" class="sq" id="bLeft" aria-label="Move left">
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
    <button type="button" class="sun drop" id="bDrop">
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg><span id="dropText">Drop</span></button>
    <button type="button" class="sq" id="bRight" aria-label="Move right">
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
    <button type="button" class="sq" id="bCam" aria-label="Reset the view" title="Reset the view">
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button>
    <button type="button" class="sq" id="bMenu" aria-label="Back to the menu" title="Back to the menu">
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg></button>
  </div>
</footer>

<div class="sr" id="live" role="status" aria-live="polite"></div>

<div class="scrim" id="mLoad" role="status"><div class="card sheet"><h2>Setting up the board<span class="dots"></span></h2></div></div>

<!-- main menu -->
<div class="scrim" id="mMenu" role="dialog" aria-modal="true" aria-labelledby="tMenu" hidden>
  <div class="card sheet">
    <span class="chip">Subscribers only content</span>
    <h2 id="tMenu">Chike&rsquo;s Gravity Four</h2>
    <p class="lede">Drop your chips and line up four in a row, across, up and down, or on a slant.</p>
    <div class="levels" role="group" aria-label="How tough Chike is">
      <button type="button" id="lvEasy" aria-pressed="true">Easy</button>
      <button type="button" id="lvSmart" aria-pressed="false">Smart</button>
    </div>
    <button type="button" class="mode" id="mAi"><picture class="face"><source media="(prefers-reduced-motion: reduce)" srcset="data:image/webp;base64,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"><img src="/assets/characters/chike-wave.webp" alt="" width="52" height="52"></picture><div><b>Play against Chike</b><span>Take on Chike</span></div></button>
    <button type="button" class="mode" id="mLocal"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg><div><b>Two players, one screen</b><span>Take turns with a friend</span></div></button>
    <button type="button" class="mode" id="mOnline" style="margin-bottom:0"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg><div><b>Play online</b><span>Share a 6-digit code with a friend</span></div></button>
  </div>
</div>

<!-- online: host or join -->
<div class="scrim" id="mOnlineMenu" role="dialog" aria-modal="true" aria-labelledby="tOnline" hidden>
  <div class="card sheet">
    <button type="button" class="back" id="oBack"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Back</button>
    <h2 id="tOnline" style="margin-top:34px">Play online</h2>
    <p class="lede">Start a match, or join your friend&rsquo;s.</p>
    <div class="box"><label>Start a new match</label><button type="button" class="sun" id="oHost" style="width:100%">Get a match code</button></div>
    <div class="box"><label for="oCode">Join a match</label>
      <div class="row"><input class="field" id="oCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="6 digits"><button type="button" class="cy" id="oJoin">Join</button></div></div>
    <p class="err" id="oErr" role="alert"></p>
  </div>
</div>

<!-- waiting for a friend -->
<div class="scrim" id="mWait" role="dialog" aria-modal="true" aria-labelledby="tWait" hidden>
  <div class="card sheet">
    <h2 id="tWait">Your match code</h2>
    <div class="code" id="codeShow" aria-label="Match code">------</div>
    <p class="lede" id="waitText">Give this code to your friend. They choose Play online, then Join.</p>
    <div class="row"><button type="button" class="blue" id="bCopy" style="flex:1"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy code</button><button type="button" id="bCancel" style="flex:1">Cancel</button></div>
  </div>
</div>

<!-- round over -->
<div class="scrim" id="mWin" role="dialog" aria-modal="true" aria-labelledby="tWin" hidden>
  <div class="card sheet">
    <div class="big" id="winDot">O</div>
    <h2 id="tWin">Cyan wins!</h2>
    <p class="lede" id="winSub">Four in a row.</p>
    <div class="stack"><button type="button" class="sun" id="wAgain">Play again</button><button type="button" id="wMenu">Main menu</button></div>
  </div>
</div>

<div class="scrim" id="nogl" hidden>
  <div class="card sheet"><h2>3D isn&rsquo;t switched on</h2><p class="lede" style="margin:8px 0 0">This game draws its board in 3D, and this browser has that turned off. Turn on hardware acceleration, or try another browser.</p></div>
</div>

<script>
/*LOGIC-START*/
/* The rules and the computer player. No page or 3D code in here, so it can be tested on its own. */
const COLS = 7, ROWS = 6, P1 = 1, P2 = 2;
const other = (p) => (p === P1 ? P2 : P1);
const newBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
/* row 0 is the bottom: a chip falls to the lowest empty row of its column */
function rowFor(b, c){ for (let r = 0; r < ROWS; r++) if (b[r][c] === 0) return r; return -1; }
function openCols(b){ const o = []; for (let c = 0; c < COLS; c++) if (b[ROWS - 1][c] === 0) o.push(c); return o; }
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
function findWin(b){
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    const p = b[r][c];
    if (!p) continue;
    for (const [dr, dc] of DIRS){
      const er = r + dr * 3, ec = c + dc * 3;
      if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
      if (b[r + dr][c + dc] === p && b[r + dr * 2][c + dc * 2] === p && b[er][ec] === p){
        return { p, cells: [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]) };
      }
    }
  }
  return null;
}
const isFull = (b) => openCols(b).length === 0;
/* how good a position looks for `me`, when the search runs out of moves */
function evaluate(b, me){
  const opp = other(me);
  let s = 0;
  for (let r = 0; r < ROWS; r++){ if (b[r][3] === me) s += 3; else if (b[r][3] === opp) s -= 3; }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    for (const [dr, dc] of DIRS){
      const er = r + dr * 3, ec = c + dc * 3;
      if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
      let mine = 0, theirs = 0;
      for (let k = 0; k < 4; k++){ const v = b[r + dr * k][c + dc * k]; if (v === me) mine++; else if (v === opp) theirs++; }
      if (mine && theirs) continue;
      if (mine === 3) s += 5; else if (mine === 2) s += 2;
      if (theirs === 3) s -= 6; else if (theirs === 2) s -= 2;
    }
  }
  return s;
}
const byCentre = (a, b) => Math.abs(a - 3) - Math.abs(b - 3);
function search(b, depth, alpha, beta, turn, me){
  const w = findWin(b);
  if (w) return w.p === me ? 100000 + depth : -100000 - depth;
  const cols = openCols(b);
  if (!cols.length) return 0;
  if (depth === 0) return evaluate(b, me);
  cols.sort(byCentre);
  const maximise = turn === me;
  let best = maximise ? -Infinity : Infinity;
  for (const c of cols){
    const r = rowFor(b, c);
    b[r][c] = turn;
    const v = search(b, depth - 1, alpha, beta, other(turn), me);
    b[r][c] = 0;
    if (maximise){ if (v > best) best = v; if (best > alpha) alpha = best; }
    else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  return best;
}
/* A chip that wins now, or blocks a win now, is found by trying every column. */
function winningCol(b, p){
  for (const c of openCols(b)){
    const r = rowFor(b, c);
    b[r][c] = p;
    const w = findWin(b);
    b[r][c] = 0;
    if (w) return c;
  }
  return -1;
}
/* level "easy" slips up now and then; "smart" looks five moves ahead. `rnd` is Math.random in the game. */
function aiMove(b, me, level, rnd){
  const cols = openCols(b);
  if (!cols.length) return -1;
  const win = winningCol(b, me);
  if (win >= 0) return win;
  const smart = level === "smart";
  const block = winningCol(b, other(me));
  if (block >= 0 && (smart || rnd() < 0.7)) return block;
  if (!smart && rnd() < 0.25) return cols[Math.floor(rnd() * cols.length)];
  const depth = smart ? 5 : 2;
  let best = -Infinity, pick = [];
  for (const c of cols.slice().sort(byCentre)){
    const r = rowFor(b, c);
    b[r][c] = me;
    const v = search(b, depth - 1, -Infinity, Infinity, other(me), me);
    b[r][c] = 0;
    if (v > best){ best = v; pick = [c]; } else if (v === best) pick.push(c);
  }
  return pick[Math.floor(rnd() * pick.length)];
}
/*LOGIC-END*/
</script>
<script>
(function(){
"use strict";

const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const NAMES = { 1: "Cyan", 2: "Sunny" };
const SB_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkY3RrZmh3eWd3d3VsaXB3bnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTUzNjUsImV4cCI6MjEwMzU5MTM2NX0.5KraVohURHNDx-n0mb6o3egJPf1KkpecBSz8fMRlQcI";

/* ---------------- game state ---------------- */
const G = { mode: "ai", level: "easy", board: newBoard(), turn: P1, moves: [], over: false, scores: [0, 0], round: 0,
  me: P1, sel: 3, thinking: false, timers: [] };
const later = (fn, ms) => { const t = setTimeout(fn, ms); G.timers.push(t); return t; };
const clearTimers = () => { G.timers.forEach(clearTimeout); G.timers = []; };

/* said to screen readers only; note() is the visible message */
function say(text){ $("live").textContent = ""; setTimeout(() => { $("live").textContent = text; }, 30); }
let noteTimer = 0;
function note(text, bad, keep){
  const p = $("note");
  clearTimeout(noteTimer);
  if (!text){ p.hidden = true; return; }
  p.textContent = text; p.className = bad ? "bad" : ""; p.hidden = false;
  if (!keep) noteTimer = setTimeout(() => { p.hidden = true; }, 3600);
}
const whoName = (p) => {
  if (G.mode === "ai") return p === P1 ? "You" : "Chike";
  if (G.mode === "online") return p === G.me ? "You" : "Your friend";
  return NAMES[p];
};
const canIPlay = () => !G.over && !G.thinking && (G.mode === "local" || (G.mode === "ai" ? G.turn === P1 : G.turn === G.me));

/* ---------------- 3D scene ---------------- */
let renderer, scene, camera, controls, ghost, hitPlane, floorShadow;
const chips = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
const falling = [];
const slotPos = (r, c) => new THREE.Vector3(c - (COLS - 1) / 2, r - (ROWS - 1) / 2, 0);
const HOME = { d: 14, y: 1.2, ty: -0.3 };

function initScene(){
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e){ $("nogl").hidden = false; $("mMenu").hidden = true; return false; }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $("gl").appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "The game board. Use the left and right arrow keys to choose a column and the down arrow or Enter to drop a chip.");

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
  controls.minAzimuthAngle = -0.95; controls.maxAzimuthAngle = 0.95;
  controls.minPolarAngle = 0.85; controls.maxPolarAngle = 1.75;

  scene.add(new THREE.AmbientLight(0xffffff, 0.64));
  const sun = new THREE.DirectionalLight(0xffffff, 0.5);
  sun.position.set(5, 9, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { near: 1, far: 40, left: -8, right: 8, top: 8, bottom: -8 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const INK = 0x1E2226;
  const matPlum = new THREE.MeshLambertMaterial({ color: 0x7A4A86 });
  const matSlate = new THREE.MeshLambertMaterial({ color: 0x1B2A32 });
  const inkLine = new THREE.LineBasicMaterial({ color: INK });

  /* the board is two plates with a gap between them, so chips fall between and show through the holes */
  const hw = COLS / 2 + 0.35, hh = ROWS / 2 + 0.35, rad = 0.3;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + rad, -hh); shape.lineTo(hw - rad, -hh); shape.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  shape.lineTo(hw, hh - rad); shape.quadraticCurveTo(hw, hh, hw - rad, hh); shape.lineTo(-hw + rad, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - rad); shape.lineTo(-hw, -hh + rad); shape.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    const p = slotPos(r, c), h = new THREE.Path();
    h.absarc(p.x, p.y, 0.46, 0, Math.PI * 2, true); shape.holes.push(h);
  }
  const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 28 });
  const plateEdges = new THREE.EdgesGeometry(plateGeo, 35);
  [0.15, -0.25].forEach((z) => {
    const m = new THREE.Mesh(plateGeo, matPlum); m.position.z = z; m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const l = new THREE.LineSegments(plateEdges, inkLine); l.position.z = z; scene.add(l);
  });
  const rail = (w, h, d, x, y) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, matSlate); m.position.set(x, y, 0); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(g), inkLine); l.position.copy(m.position); scene.add(l);
  };
  rail(0.32, hh * 2 - 0.2, 0.56, -(hw - 0.2), 0);
  rail(0.32, hh * 2 - 0.2, 0.56, hw - 0.2, 0);
  rail(hw * 2 - 0.2, 0.32, 0.56, 0, -(hh - 0.16));
  rail(hw * 2 + 0.9, 0.4, 2.2, 0, -hh - 0.2);

  floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floorShadow.rotation.x = -Math.PI / 2; floorShadow.position.y = -hh - 0.4; floorShadow.receiveShadow = true; scene.add(floorShadow);

  clock = new THREE.Clock();
  ray = new THREE.Raycaster(); pt = new THREE.Vector2(); hitAt = new THREE.Vector3();
  hitPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  ghost = makeChip(P1, true); ghost.visible = false; scene.add(ghost);

  resize();
  return true;
}

let CHIP;
function makeChip(p, isGhost){
  if (!CHIP){
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.24, 40); geo.rotateX(Math.PI / 2);
    CHIP = { geo, cyan: new THREE.MeshLambertMaterial({ color: 0x17B3CE }), sun: new THREE.MeshLambertMaterial({ color: 0xF5B921 }),
      ink: new THREE.MeshBasicMaterial({ color: 0x1E2226 }), hull: new THREE.MeshBasicMaterial({ color: 0x1E2226, side: THREE.BackSide }),
      ring: new THREE.TorusGeometry(0.2, 0.05, 12, 36), bar: new THREE.BoxGeometry(0.52, 0.1, 0.03) };
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(CHIP.geo, p === P1 ? CHIP.cyan : CHIP.sun);
  body.castShadow = true; g.add(body);
  const hull = new THREE.Mesh(CHIP.geo, CHIP.hull); hull.scale.setScalar(1.08); g.add(hull);
  [0.125, -0.125].forEach((z) => {
    if (p === P1){ const m = new THREE.Mesh(CHIP.ring, CHIP.ink); m.position.z = z; g.add(m); }
    else [Math.PI / 4, -Math.PI / 4].forEach((a) => { const m = new THREE.Mesh(CHIP.bar, CHIP.ink); m.rotation.z = a; m.position.z = z; g.add(m); });
  });
  if (isGhost){
    g.children.forEach((m) => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.5; } });
  }
  g.userData.player = p;
  return g;
}

function fitCamera(){
  const aspect = camera.aspect, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const needH = 5.6 / tan, needW = 5.4 / (tan * aspect);
  const small = window.innerWidth < 560;
  HOME.d = Math.max(needH * (small ? 1.2 : 1.08), needW * 1.04);
  HOME.ty = small ? -0.1 : -0.35;
  controls.minDistance = HOME.d * 0.55; controls.maxDistance = HOME.d * 1.35;
}
function homeView(){
  camera.position.set(0, HOME.y, HOME.d);
  controls.target.set(0, HOME.ty, 0);
  controls.update();
}
function resize(){
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const wasHome = !G.userMoved;
  fitCamera();
  if (wasHome) homeView();
}
window.addEventListener("resize", resize);

/* a chip falls, bounces a little, and settles in its hole */
function dropChip(c, r, p, done){
  const chip = makeChip(p);
  const to = slotPos(r, c), from = slotPos(ROWS - 1, c);
  from.y += 2.6;
  chip.position.copy(from);
  scene.add(chip);
  chips[r][c] = chip;
  let y = from.y, vy = 0, bounces = 0, t = 0;
  falling.push((dt) => {
    if (REDUCED){
      t += dt;
      const k = Math.min(1, t / 0.16);
      chip.position.y = from.y + (to.y - from.y) * k;
      if (k >= 1){ chip.position.y = to.y; if (done) done(); return true; }
      return false;
    }
    vy -= 34 * dt; y += vy * dt;
    if (y <= to.y){
      y = to.y;
      if (Math.abs(vy) > 1.6 && bounces < 3){ vy = -vy * 0.4; bounces++; }
      else { chip.position.y = to.y; if (done) done(); return true; }
    }
    chip.position.y = y;
    return false;
  });
}

const winners = [];
function glow(cells, p){
  cells.forEach(([r, c]) => {
    const chip = chips[r][c];
    if (!chip) return;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
    halo.position.z = 0.0; chip.add(halo);
    winners.push({ chip, halo, base: chip.position.z });
  });
}
function clearBoardMeshes(){
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    if (chips[r][c]){ scene.remove(chips[r][c]); chips[r][c] = null; }
  }
  falling.length = 0; winners.length = 0;
}

let clock;
function frame(){
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  for (let i = falling.length - 1; i >= 0; i--) if (falling[i](dt)) falling.splice(i, 1);
  if (!REDUCED) winners.forEach((w) => { w.chip.position.z = Math.sin(t * 6) * 0.07; w.halo.rotation.z = t * 2; });
  controls.update();
  renderer.render(scene, camera);
}

/* ---------------- choosing a column ---------------- */
let ray, pt, hitAt;   /* made in initScene, once the 3D library is here */
function colAt(ev){
  const rect = renderer.domElement.getBoundingClientRect();
  pt.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pt, camera);
  if (!ray.ray.intersectPlane(hitPlane, hitAt)) return -1;
  const c = Math.floor(hitAt.x + COLS / 2);
  if (c < -1 || c > COLS || hitAt.y < -4.2 || hitAt.y > 6) return -1;
  return Math.max(0, Math.min(COLS - 1, c));
}
function select(c){
  G.sel = Math.max(0, Math.min(COLS - 1, c));
  paintGhost();
  $("dropText").textContent = "Drop in column " + (G.sel + 1);
}
function paintGhost(){
  if (!ghost) return;
  const show = !$("hudBot").hidden && canIPlay() && !anyModal();
  ghost.visible = show;
  if (!show) return;
  const p = slotPos(ROWS - 1, G.sel);
  ghost.position.set(p.x, p.y + 1.25, 0);
  const want = G.mode === "local" ? G.turn : (G.mode === "ai" ? P1 : G.me);
  if (ghost.userData.player !== want){
    scene.remove(ghost); ghost = makeChip(want, true); ghost.userData.player = want; scene.add(ghost);
    ghost.position.set(p.x, p.y + 1.25, 0);
  }
}

let down = null;
function wirePointer(){
  const el = renderer.domElement;
  el.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || (e.buttons & 1)) return;
    const c = colAt(e); if (c >= 0 && c !== G.sel) select(c);
  });
  el.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  controls.addEventListener("start", () => { G.userMoved = true; });
  el.addEventListener("pointerup", (e) => {
    const d = down; down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || performance.now() - d.t > 600) return;
    const c = colAt(e); if (c < 0) return;
    /* a mouse click drops; on a touch screen the first tap picks the column and the next one drops */
    if (e.pointerType === "mouse" || c === G.sel) { select(c); tryDrop(); }
    else select(c);
  });
}
window.addEventListener("keydown", (e) => {
  if (anyModal() || $("hudBot").hidden) return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === "ArrowLeft"){ select(G.sel - 1); e.preventDefault(); }
  else if (e.key === "ArrowRight"){ select(G.sel + 1); e.preventDefault(); }
  else if (e.key === "ArrowDown" || ((e.key === "Enter" || e.key === " ") && e.target === renderer.domElement)){ tryDrop(); e.preventDefault(); }
  else if (e.key >= "1" && e.key <= "7"){ select(parseInt(e.key, 10) - 1); }
});

/* ---------------- playing ---------------- */
function tryDrop(){
  if (G.over) return;
  if (!canIPlay()){
    if (!G.thinking && G.mode === "online") note("It’s your friend’s turn.");
    return;
  }
  if (rowFor(G.board, G.sel) < 0){ note("That column is full. Pick another one.", true); return; }
  const col = G.sel;
  play(col, G.turn);
  if (G.mode === "online") netSend({ t: "move", col, n: G.moves.length - 1 });
}

/* puts the chip down and moves the game on at once; the falling is only for show */
function play(col, p){
  const r = rowFor(G.board, col);
  if (r < 0) return false;
  G.board[r][col] = p;
  G.moves.push(col);
  const idx = G.moves.length - 1;
  const win = findWin(G.board);
  const tie = !win && isFull(G.board);
  if (win){ G.over = true; G.scores[win.p - 1]++; }
  else if (tie) G.over = true;
  else G.turn = other(p);
  paintHud();
  say(whoName(p) + " dropped a chip in column " + (col + 1) + "." + (win || tie ? "" : " " + turnLine()));
  dropChip(col, r, p, () => {
    if (!G.over) { if (G.mode === "ai" && G.turn === P2 && idx === G.moves.length - 1) chikeTurn(); return; }
    if (idx !== G.moves.length - 1) return;
    if (win) glow(win.cells, win.p);
    later(() => endRound(win ? win.p : 0), REDUCED ? 200 : 1100);
  });
  paintGhost();
  return true;
}

function chikeTurn(){
  G.thinking = true; paintHud(); paintGhost();
  later(() => {
    const col = aiMove(G.board, P2, G.level, Math.random);
    G.thinking = false;
    if (col >= 0 && !G.over) play(col, P2);
  }, 450);
}

const turnLine = () => {
  if (G.mode === "ai") return G.turn === P1 ? "Your turn." : "Chike is thinking.";
  if (G.mode === "online") return G.turn === G.me ? "Your turn." : "Waiting for your friend.";
  return NAMES[G.turn] + "’s turn.";
};

function paintHud(){
  $("s1").textContent = G.scores[0]; $("s2").textContent = G.scores[1];
  if (G.mode === "ai"){ $("n1").textContent = "You · Cyan"; $("n2").textContent = "Chike · Sunny"; }
  else if (G.mode === "online"){
    $("n1").textContent = (G.me === P1 ? "You" : "Friend") + " · Cyan";
    $("n2").textContent = (G.me === P2 ? "You" : "Friend") + " · Sunny";
  } else { $("n1").textContent = "Cyan"; $("n2").textContent = "Sunny"; }
  const dot = $("turnDot");
  dot.className = "dot " + (G.turn === P1 ? "p1" : "p2"); dot.textContent = G.turn === P1 ? "O" : "X";
  $("turnText").textContent = G.over ? "Round over" : turnLine().replace(/\.$/, "");
  $("turn").hidden = $("hudBot").hidden;
  const mine = canIPlay();
  $("bDrop").disabled = !mine; $("bLeft").disabled = G.over; $("bRight").disabled = G.over;
}

function endRound(winner){
  if (!G.over) return;
  const dot = $("winDot");
  if (!winner){
    dot.className = "big"; dot.style.background = "#fff"; dot.textContent = "=";
    $("tWin").textContent = "It’s a tie!"; $("winSub").textContent = "The board is full. Nobody got four in a row.";
  } else {
    dot.className = "big"; dot.style.background = winner === P1 ? "var(--cyan)" : "var(--sun)"; dot.textContent = winner === P1 ? "O" : "X";
    const me = G.mode === "ai" ? winner === P1 : (G.mode === "online" ? winner === G.me : null);
    $("tWin").textContent = G.mode === "local" ? NAMES[winner] + " wins!" : me ? "You win!" : (G.mode === "ai" ? "Chike wins!" : "Your friend wins!");
    $("winSub").textContent = "Four in a row.";
  }
  say($("tWin").textContent);
  showModal("mWin", "wAgain");
}

function startRound(){
  clearTimers();
  clearBoardMeshes();
  G.board = newBoard(); G.moves = []; G.over = false; G.thinking = false;
  /* the player who went second goes first in the next round */
  G.turn = G.round % 2 === 0 ? P1 : P2;
  paintHud(); select(3);
  say("New round. " + turnLine());
  if (G.mode === "ai" && G.turn === P2) chikeTurn();
}
function startMatch(mode, me){
  G.mode = mode; G.me = me || P1; G.scores = [0, 0]; G.round = 0;
  closeModals(); $("hudBot").hidden = false;
  startRound();
  if (mode === "ai") homeView();
  paintHud();
}
function toMenu(){
  clearTimers(); netLeave();
  clearBoardMeshes(); G.over = true; G.moves = []; G.board = newBoard();
  $("hudBot").hidden = true; $("turn").hidden = true; note("");
  if (ghost) ghost.visible = false;
  showModal("mMenu", "mAi");
}

/* ---------------- menus ---------------- */
const MODALS = ["mMenu", "mOnlineMenu", "mWait", "mWin"];
const anyModal = () => MODALS.some((id) => !$(id).hidden) || !$("nogl").hidden;
function closeModals(){ MODALS.forEach((id) => { $(id).hidden = true; }); setInert(false); paintGhost(); }
function setInert(on){ ["hudTop", "hudBot"].forEach((id) => { if (on) $(id).setAttribute("inert", ""); else $(id).removeAttribute("inert"); }); }
function showModal(id, focusId){
  MODALS.forEach((m) => { $(m).hidden = m !== id; });
  setInert(true);
  if (ghost) ghost.visible = false;
  setTimeout(() => { const f = $(focusId); if (f) f.focus(); }, 30);
}

$("lvEasy").onclick = () => { G.level = "easy"; $("lvEasy").setAttribute("aria-pressed", "true"); $("lvSmart").setAttribute("aria-pressed", "false"); };
$("lvSmart").onclick = () => { G.level = "smart"; $("lvSmart").setAttribute("aria-pressed", "true"); $("lvEasy").setAttribute("aria-pressed", "false"); };
$("mAi").onclick = () => startMatch("ai");
$("mLocal").onclick = () => startMatch("local");
$("mOnline").onclick = () => { $("oErr").textContent = ""; showModal("mOnlineMenu", "oHost"); };
$("oBack").onclick = () => showModal("mMenu", "mOnline");
$("wAgain").onclick = () => {
  G.round++;
  if (G.mode === "online") netSend({ t: "again", round: G.round });
  closeModals(); startRound();
};
$("wMenu").onclick = toMenu;
$("bMenu").onclick = toMenu;
$("bCam").onclick = () => { G.userMoved = false; homeView(); };
$("bLeft").onclick = () => select(G.sel - 1);
$("bRight").onclick = () => select(G.sel + 1);
$("bDrop").onclick = tryDrop;
$("oCode").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
$("oCode").addEventListener("keydown", (e) => { if (e.key === "Enter"){ e.preventDefault(); $("oJoin").click(); } });
$("bCancel").onclick = () => { netLeave(); showModal("mOnlineMenu", "oHost"); };
$("bCopy").onclick = async () => {
  const code = NET.code;
  try { await navigator.clipboard.writeText(code); note("Code copied.", false); return; } catch (e) { /* blocked: select it so Ctrl+C works */ }
  try { const r = document.createRange(); r.selectNodeContents($("codeShow")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* ignore */ }
  note("Press Ctrl+C (or Cmd+C) to copy the code.");
};

/* ---------------- playing online ----------------
   Rooms are live only. They use Supabase Realtime broadcast, so nothing is saved anywhere: no accounts,
   no names, no chat. The host is Cyan and goes first; the match ends when either player leaves. */
const NET = { sb: null, ch: null, id: "", code: "", role: "", peer: "", last: 0, hb: 0, taken: false, hostSeen: "", started: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function loadScript(src){ return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("load")); document.head.appendChild(s); }); }
/* The 3D library: pinned on unpkg first, then the copy on this site. (A sealed frame can always reach unpkg;
   the site's own copy is the fallback if that is ever down.) */
const LIB_SOURCES = [
  ["https://unpkg.com/three@0.128.0/build/three.min.js", "https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js"],
  ["/assets/vendor/three.min.js", "/assets/vendor/three-orbit-controls.js"],
];
async function loadLibs(){
  for (const [core, controls] of LIB_SOURCES){
    try { await loadScript(core); await loadScript(controls); if (window.THREE && THREE.OrbitControls) return true; }
    catch (e) { /* try the next source */ }
  }
  return false;
}
async function netClient(){
  if (NET.sb) return NET.sb;
  if (!window.supabase){
    try { await loadScript("/assets/vendor/supabase.js"); }
    catch (e) { await loadScript("https://unpkg.com/@supabase/supabase-js@2.112.4/dist/umd/supabase.js"); }
  }
  /* its own anonymous client: it never touches the site's sign-in */
  NET.sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, realtime: { params: { eventsPerSecond: 20 } } });
  return NET.sb;
}
function netSend(p){
  if (!NET.ch) return;
  p.i = NET.id;
  try { const r = NET.ch.send({ type: "broadcast", event: "g", payload: p }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* offline */ }
}
async function netOpen(code){
  const sb = await netClient();
  return new Promise((ok, no) => {
    const ch = sb.channel("g4-room-" + code, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "g" }, (e) => netOn(e.payload));
    const to = setTimeout(() => no(new Error("timeout")), 9000);
    ch.subscribe((st) => {
      if (st === "SUBSCRIBED"){ clearTimeout(to); ok(ch); }
      else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT"){ clearTimeout(to); no(new Error(st)); }
    });
  });
}
async function netDrop(ch){ try { if (NET.sb && ch) await NET.sb.removeChannel(ch); } catch (e) { /* already gone */ } }
function netReset(){ clearInterval(NET.hb); NET.ch = null; NET.code = ""; NET.role = ""; NET.peer = ""; NET.taken = false; NET.hostSeen = ""; NET.started = false; }
async function netLeave(){
  const ch = NET.ch;
  if (ch){ netSend({ t: "bye" }); }
  netReset();
  await netDrop(ch);
}
function netBeat(){
  clearInterval(NET.hb);
  NET.last = Date.now();
  NET.hb = setInterval(() => {
    netSend({ t: "beat" });
    if (NET.started && Date.now() - NET.last > 14000) friendLeft();
  }, 2000);
}
function friendLeft(){
  if (!NET.started) return;
  netLeave();
  clearTimers(); G.over = true;
  closeModals(); $("hudBot").hidden = true; $("turn").hidden = true;
  $("oErr").textContent = "Your friend left the match.";
  showModal("mOnlineMenu", "oHost");
  say("Your friend left the match.");
}
const makeCode = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, "0")).join("");

function netOn(m){
  if (!m || typeof m !== "object" || typeof m.i !== "string" || m.i === NET.id) return;
  if (NET.peer && m.i !== NET.peer && m.t !== "join" && m.t !== "who") return;
  if (NET.peer && m.i === NET.peer) NET.last = Date.now();
  switch (m.t){
    case "who": if (NET.role === "host") netSend(NET.peer && m.i !== NET.peer ? { t: "full", to: m.i } : { t: "hi" }); break;
    case "hi": if (NET.role === "host") NET.taken = true; else if (!NET.hostSeen) NET.hostSeen = m.i; break;
    case "join":
      if (NET.role !== "host") break;
      if (NET.peer && NET.peer !== m.i){ netSend({ t: "full", to: m.i }); break; }
      NET.peer = m.i; NET.last = Date.now(); NET.started = true;
      netSend({ t: "start", to: m.i });
      startMatch("online", P1);
      break;
    case "full": if (m.to === NET.id) NET.full = true; break;
    case "start": if (m.to === NET.id && NET.role === "guest" && !NET.started){ NET.peer = m.i; NET.started = true; NET.last = Date.now(); NET.gotStart = true; } break;
    case "move": {
      if (!NET.started || G.mode !== "online" || G.over) break;
      const col = m.col, n = m.n;
      if (!Number.isInteger(col) || col < 0 || col >= COLS || !Number.isInteger(n)) break;
      if (G.turn === G.me) break;
      if (n < G.moves.length) break;
      if (n > G.moves.length){ netSend({ t: "sync" }); break; }
      play(col, G.turn);
      break;
    }
    case "sync": netSend({ t: "state", round: G.round, moves: G.moves.slice(), scores: G.scores.slice() }); break;
    case "state": {
      if (!Array.isArray(m.moves) || m.moves.length <= G.moves.length || m.moves.length > ROWS * COLS || G.over) break;
      if (!m.moves.every((c) => Number.isInteger(c) && c >= 0 && c < COLS)) break;
      for (let k = G.moves.length; k < m.moves.length; k++) if (!G.over) play(m.moves[k], G.turn);
      break;
    }
    case "again":
      if (G.mode === "online" && G.over && m.round === G.round + 1){
        G.round = m.round; closeModals(); startRound(); note("Your friend started a new round.");
      }
      break;
    case "bye": friendLeft(); break;
    default: break;
  }
}
const oErr = (t) => { $("oErr").textContent = t; };
const failText = { timeout: "Couldn’t reach the game server. Check your connection and try again.", load: "Couldn’t load online play. Check your connection and try again." };

$("oHost").onclick = async () => {
  oErr(""); $("oHost").disabled = true; $("oHost").textContent = "Getting a code…";
  try {
    NET.id = rid();
    for (let i = 0; i < 6; i++){
      const code = makeCode();
      const ch = await netOpen(code);
      NET.ch = ch; NET.code = code; NET.role = "host"; NET.peer = ""; NET.taken = false; NET.started = false;
      netSend({ t: "who" }); await sleep(900);
      if (NET.taken){ NET.ch = null; await netDrop(ch); continue; }          /* someone already hosts this code */
      netBeat();
      $("codeShow").textContent = code;
      $("waitText").textContent = "Give this code to your friend. They choose Play online, then Join.";
      showModal("mWait", "bCopy");
      return;
    }
    oErr("Couldn’t find a free code. Try again.");
  } catch (e) {
    netReset(); oErr(failText[e && e.message] || "Couldn’t start an online match. Try again.");
  } finally { $("oHost").disabled = false; $("oHost").textContent = "Get a match code"; }
};

$("oJoin").onclick = async () => {
  const code = $("oCode").value.trim();
  if (!/^\d{6}$/.test(code)){ oErr("Type the 6 digits your friend gave you."); $("oCode").focus(); return; }
  oErr(""); $("oJoin").disabled = true;
  try {
    NET.id = rid();
    const ch = await netOpen(code);
    NET.ch = ch; NET.code = code; NET.role = "guest"; NET.peer = ""; NET.hostSeen = ""; NET.full = false; NET.gotStart = false; NET.started = false;
    netSend({ t: "who" });
    for (let t = 0; t < 12 && !NET.hostSeen && !NET.full; t++) await sleep(300);
    if (NET.full){ await netLeave(); oErr("That match already has two players."); return; }
    if (!NET.hostSeen){ await netLeave(); oErr("There’s no match with that code. Check the digits and try again."); return; }
    NET.peer = NET.hostSeen;
    netSend({ t: "join" });
    for (let t = 0; t < 14 && !NET.gotStart && !NET.full; t++) await sleep(300);
    if (NET.full){ await netLeave(); oErr("That match already has two players."); return; }
    if (!NET.gotStart){ await netLeave(); oErr("Your friend didn’t answer. Ask them to try again."); return; }
    netBeat();
    startMatch("online", P2);
  } catch (e) {
    await netLeave(); oErr(failText[e && e.message] || "Couldn’t join. Try again.");
  } finally { $("oJoin").disabled = false; }
};
window.addEventListener("pagehide", () => { if (NET.ch) netSend({ t: "bye" }); });

/* ---------------- go ---------------- */
loadLibs().then((ok) => {
  $("mLoad").hidden = true;
  if (!ok){ $("nogl").hidden = false; return; }
  if (initScene()){
    wirePointer();
    homeView();
    select(3);
    showModal("mMenu", "mAi");
    frame();
  }
});
window.__g4 = { G, NET, play, startMatch, select, tryDrop };
})();
</script>
</body>
</html>
$g4code$, 'bytes', 53729))
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into portal_entries (id, data)
values ('portal-gravity-four', $g4entry${"id":"portal-gravity-four","layout":"game","title":"Gravity Four","slug":"chikes-gravity-four","description":"A 3D chip-dropping game made just for newsletter members. Drop your chips, beat Chike, or challenge a friend online. Then learn how to make your own game with AI!","category":"New games","publishedAt":"2026-10-26","cover":{"src":"assets/games/gravity-four-loop.gif","alt":"Chike smiling at his computer while playing Gravity Four, then laughing and pointing at the board, in a looping animation."},"coverStill":"assets/games/gravity-four.webp","body":"","aiPromptTip":"Gemini is an AI helper that follows instructions. The clearer your words, the better your game! If something isn’t right, just tell it what to change, like “make the board green” or “add a fun sound when someone wins.”","vocabWord":"gravity","vocabSay":"GRAV-ih-tee · noun","vocabMeaning":"The invisible pull that brings things down to the ground.","vocabExample":"In this game, gravity pulls your chip down to the lowest empty spot in the column!","howToPlay":["Pick who to play against: Chike, a friend on the same screen, or a friend far away with a 6-digit code.","Pick a column, then press Drop (or click the board). Your chip falls to the lowest empty spot!","Be the first to line up 4 chips in a row: across, up and down, or on a slant.","Block your friend by dropping a chip where they need one.","Drag the board to spin it and look around. On a keyboard, use the arrow keys to move and Enter to drop.","Win a round, then press Play again!"],"aiPromptTitle":"Make your own Gravity Four game","aiPrompt":"🎮 Chike's Gravity Four!\nMake a fun 3D chip-dropping game in one HTML file.\n\n🌟 How to win:\n• Make a board with 7 columns and 6 rows.\n• Line up 4 chips in a row to win! The row can go across, up and down, or on a slant.\n• When I drop a chip, it falls and bounces like a real coin. I can't drop another chip until it stops.\n• Please don't add any sounds or music.\n\n🕹️ 3 ways to play:\n1. Vs. Computer: a smart player that tries to win and to block me.\n2. 2 Players: me and a friend on the same screen.\n3. Play Online: a friend far away joins with a special 6-digit code.\n\n🎨 How it looks:\n• A cool 3D board with holes.\n• Bright blue \"O\" chips and yellow \"X\" chips.\n• A see-through chip shows where my chip will land.\n• The 4 winning chips glow!\n• Menus and buttons that work on phones, tablets and computers, so I can pick a mode, type a code, see whose turn it is, and play again.","gameMode":"launch","gameLabel":"Play Gravity Four","gameId":"","privateGameId":"gravity-four","privateGameKb":52,"gamePath":"","bookId":"","bookMode":"launch","bookPath":"","buttonLabel":"","buttonUrl":"","textFirst":"after","gallery":[],"email":{"on":true,"subject":"A new game, just for you: Chike’s Gravity Four","preview":"Drop chips, line up four. Play against Chike or a friend.","message":"We made a new game for our newsletter family: Chike’s Gravity Four.\n\nDrop your chips and line up four in a row. Play against Chike, take turns on one screen, or share a code and play a friend online.","button":"Play now"},"adminNote":"Members-only game. Its code lives in portal_game_files, not on the site. Cover picture is set. Review it, then Publish.","status":"draft"}$g4entry$::jsonb)
on conflict (id) do nothing;
