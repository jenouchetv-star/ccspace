/* Chike's Creative Space - Bolt's Obstacle Course: the logic (owner spec 2026-11-28,
   Downloads/Bolts_Obstacle_Course_Spec.md). No drawing here: the course, Bolt's moves and the program runner, so they
   can be tested on their own (test/boltCourse.test.js) and the game file only animates what this decides.

   Three layers, as the spec asks:
   - the interpreter: run(blocks) is a generator that hands out one action at a time (pausable, steppable), with the
     safety caps (500 steps, 50 loops for "repeat until", 8 deep for My blocks);
   - the simulation: a World built from a level's data, and perform(block, world) that moves Bolt by the rules;
   - the renderer lives in the game file.

   The course is a side view on a grid. 1 tile = 1 ft. y grows downward; the bottom row is ground (unless a gap
   removes it) and Bolt stands on top of whatever is under him.

   Movement rules (builder's calls, to confirm in play tests):
   - Walk: one tile left or right. Something solid in the way stops him ("Something's in my way!").
   - Jump: up to 2 ft. A forward jump rises 2 ft and moves 1 tile; if the spot 2 ft up there is solid, the wall is too
     tall ("My jump only goes 2 feet. What else can I try?").
   - Fly up 1-5: rises that many feet (1 battery each), stopping under anything above.
   - Rocket burst: 1 tile forward at the same height (1 battery).
   - After a jump, a flight or a rocket burst Bolt is still in the air when the next block starts: a walk or another
     rocket burst carries him across first, anything else drops him straight down. So a 1 ft gap is "rocket, walk",
     a 2 ft gap is "rocket, rocket, walk" or "jump, rocket, walk", and "fly 4, walk" lands on top of a 4 ft wall.
   - Wheels and legs: one mode at a time; wheels can't climb stairs; legs take two walks per ramp tile.
   - Stairs (legs only): up one step per block. Ladder up/down: the whole ladder in one block.
   - Falling off the bottom of the course is a friendly failure, never a game over: the child fixes and tries again.

   Classic script: sets window.BoltCourse (the game loads it from /assets/lib/boltCourse.js). */
(function (root) {
  const MAX_STEPS = 500;          // the whole program, as the spec's global safety cap
  const DEFAULT_MAX_LOOPS = 50;   // "repeat until"
  const MAX_CALL_DEPTH = 8;       // My blocks calling My blocks
  const BATTERY_FULL = 10, BATTERY_PICKUP = 3, BATTERY_LOW = 3;
  const JUMP_FT = 2, FLY_MAX = 5;

  class KidFriendlyError extends Error {
    constructor(reason, blockId, message) { super(message); this.reason = reason; this.blockId = blockId; }
  }
  const fail = (reason, message) => ({ ok: false, reason, message });
  const OK = { ok: true };

  /* ---------- the world ---------- */
  class World {
    constructor(level) {
      this.level = level;
      const g = level.grid || { width: 14, height: 8 };
      this.w = g.width; this.h = g.height;
      this.solid = new Set(); this.kind = new Map();
      this.ground = new Set();
      for (let x = 0; x < this.w; x++) this.ground.add(x);
      this.ramps = new Map();      // "x,y" -> the ramp's rise direction (+1 right)
      this.stairs = new Set();     // "x,y" stair step tiles
      this.ladders = [];           // { x, top, bottom }
      for (const o of level.obstacles || []) this.place(o);
      for (const x of this.ground) this.put(x, this.h - 1, "ground");
      this.x = level.start.x; this.y = level.start.y;
      this.facing = level.start.facing === "left" ? -1 : 1;
      this.mode = level.start.mode === "wheels" ? "wheels" : "legs";
      this.battery = level.start.battery == null ? BATTERY_FULL : level.start.battery;
      this.air = false;            // still in the air after a jump, flight or rocket burst
      this.slow = 0;               // half a ramp tile walked on legs
      this.pickups = (level.pickups || []).map((p) => ({ type: p.type, x: p.x, y: p.y, taken: false }));
      this.trail = [];
      this.settle();
    }
    key(x, y) { return x + "," + y; }
    put(x, y, kind) { this.solid.add(this.key(x, y)); this.kind.set(this.key(x, y), kind); }
    place(o) {
      if (o.type === "gap") { for (let i = 0; i < (o.width || 1); i++) this.ground.delete(o.x + i); return; }
      if (o.type === "wall" || o.type === "crate") { for (let i = 0; i < (o.heightFt || 1); i++) this.put(o.x, o.y - i, o.type); return; }
      if (o.type === "stairs") {
        const dir = o.dir === "left" ? -1 : 1;
        for (let i = 0; i < (o.steps || 3); i++) for (let j = 0; j <= i; j++) { this.put(o.x + i * dir, o.y - j, "stairs"); this.stairs.add(this.key(o.x + i * dir, o.y - j)); }
        return;
      }
      if (o.type === "ramp") {
        const dir = o.dir === "left" ? -1 : 1;
        /* tile i of the ramp is i + 1 ft high: Bolt stands on it at o.y - (i + 1) */
        for (let i = 0; i < (o.length || 3); i++) { for (let j = 0; j <= i; j++) this.put(o.x + i * dir, o.y - j, "ramp"); this.ramps.set(this.key(o.x + i * dir, o.y - i - 1), dir); }
        return;
      }
      if (o.type === "ladder") { this.ladders.push({ x: o.x, bottom: o.y, top: o.y - (o.heightFt || 3) + 1 }); return; }
    }
    isSolid(x, y) { return this.solid.has(this.key(x, y)); }
    kindAt(x, y) { return this.kind.get(this.key(x, y)) || ""; }
    inside(x) { return x >= 0 && x < this.w; }
    supported(x, y) { return y + 1 >= this.h ? false : this.isSolid(x, y + 1) || this.ladderAt(x, y + 1); }
    ladderAt(x, y) { return this.ladders.some((l) => l.x === x && y >= l.top && y <= l.bottom); }
    /** drop straight down until something holds him; false when he falls off the bottom */
    settle() {
      this.air = false;
      while (!this.supported(this.x, this.y)) {
        if (this.y >= this.h - 1) return false;
        this.y++;
        this.trail.push({ x: this.x, y: this.y, drop: true });
      }
      this.collect();
      return true;
    }
    collect() {
      for (const p of this.pickups) if (!p.taken && p.x === this.x && p.y === this.y) {
        p.taken = true;
        if (p.type === "battery") this.battery = Math.min(BATTERY_FULL, this.battery + BATTERY_PICKUP);
      }
    }
    moveTo(x, y) { this.x = x; this.y = y; this.trail.push({ x, y }); this.collect(); }
    atGoal() { const g = this.level.goal; return !!g && this.x === g.x && this.y === g.y; }
    /** the sensor conditions for "if" and "repeat until" */
    check(cond) {
      const ax = this.x + this.facing, y = this.y;
      switch (cond) {
        case "wall_ahead": return this.inside(ax) && this.isSolid(ax, y) && this.kindAt(ax, y) !== "crate" && !this.stairs.has(this.key(ax, y));
        case "crate_ahead": return this.kindAt(ax, y) === "crate";
        case "gap_ahead": { if (!this.inside(ax)) return false; for (let yy = y; yy < this.h; yy++) if (this.isSolid(ax, yy)) return false; return true; }
        case "stairs_ahead": return this.stairs.has(this.key(ax, y));
        case "ramp_ahead": return this.ramps.has(this.key(ax, y - 1)) || this.ramps.has(this.key(ax, y));
        case "ladder_ahead": return this.ladderAt(ax, y) || this.ladderAt(this.x, y);
        case "switch_ahead": return false;   // switches arrive with the Switch Factory levels
        case "at_goal": return this.atGoal();
        case "battery_low": return this.battery <= BATTERY_LOW;
        default: return false;
      }
    }
    snapshot() { return { x: this.x, y: this.y, facing: this.facing, mode: this.mode, battery: this.battery, air: this.air }; }
  }

  /* ---------- Bolt's moves ---------- */
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], "up-left": [-1, -1], "up-right": [1, -1], "down-left": [-1, 1], "down-right": [1, 1] };
  const FELL = () => fail("fell", "Whoops, I fell! Try a jump or a rocket burst over the gap.");

  /** Do one primitive block. Returns { ok } or a kid-friendly { ok:false, reason, message }. */
  function perform(block, w) {
    const keepsAir = block.type === "walk" || block.type === "rocket";
    if (w.air && !keepsAir && !w.settle()) return FELL();
    switch (block.type) {
      case "walk": {
        const dx = block.dir === "left" ? -1 : 1;
        w.facing = dx;
        const nx = w.x + dx;
        if (!w.inside(nx)) return fail("edge", "That's the end of the course!");
        const rampUp = w.ramps.has(w.key(nx, w.y - 1)) && !w.air;
        if (rampUp && w.mode === "legs" && w.slow === 0) { w.slow = 1; return OK; }   // legs: two walks per ramp tile
        w.slow = 0;
        if (rampUp) { w.moveTo(nx, w.y - 1); return OK; }
        if (w.isSolid(nx, w.y)) {
          if (w.stairs.has(w.key(nx, w.y))) return fail("stairs_ahead", w.mode === "wheels" ? "Wheels can't climb stairs. Switch to legs!" : "Stairs! Use the Climb stairs block.");
          return fail("blocked", "Something's in my way! Can I jump or fly over it?");
        }
        w.moveTo(nx, w.y);
        return w.settle() ? OK : FELL();
      }
      case "jump": {
        const [dx] = DIRS[block.dir] || DIRS.right;
        if (dx) w.facing = dx;
        for (let i = 1; i <= JUMP_FT; i++) if (w.isSolid(w.x, w.y - i)) return fail("ceiling", "Ouch, something's above me!");
        const nx = w.x + dx, ny = w.y - JUMP_FT;
        if (dx && (!w.inside(nx))) return fail("edge", "That's the end of the course!");
        if (w.isSolid(nx, ny)) return fail("jump_too_short", "My jump only goes 2 feet. What else can I try?");
        w.moveTo(nx, ny); w.air = true;
        return OK;
      }
      case "fly": {
        const feet = Math.max(1, Math.min(FLY_MAX, Math.floor(block.feet) || 1));
        if (w.battery < feet) return fail("low_battery", "My battery is too low!");
        w.battery -= feet;
        let y = w.y;
        for (let i = 0; i < feet; i++) { if (y - 1 < 0 || w.isSolid(w.x, y - 1)) break; y--; }
        w.moveTo(w.x, y); w.air = true;
        return OK;
      }
      case "rocket": {
        if (w.battery < 1) return fail("low_battery", "My battery is too low!");
        const nx = w.x + w.facing;
        if (!w.inside(nx)) return fail("edge", "That's the end of the course!");
        if (w.isSolid(nx, w.y)) return fail("blocked", "Something's in my way!");
        w.battery -= 1;
        w.moveTo(nx, w.y); w.air = true;
        return OK;
      }
      case "mode": { w.mode = block.mode === "wheels" ? "wheels" : "legs"; w.slow = 0; return OK; }
      case "stairs": {
        if (w.mode !== "legs") return fail("wheels_on_stairs", "Wheels can't climb stairs. Switch to legs!");
        const nx = w.x + w.facing;
        if (!w.stairs.has(w.key(nx, w.y)) || w.isSolid(nx, w.y - 1)) return fail("no_stairs", "There are no stairs here.");
        w.moveTo(nx, w.y - 1);
        return OK;
      }
      case "ladder": {
        const l = w.ladders.find((L) => (L.x === w.x || L.x === w.x + w.facing) && w.y >= L.top - 1 && w.y <= L.bottom + 1);
        if (!l) return fail("no_ladder", "There's no ladder here.");
        if (block.dir === "down") { w.moveTo(l.x, l.bottom); return w.settle() ? OK : FELL(); }
        w.moveTo(l.x, l.top - 1);
        return OK;
      }
      case "wait": return OK;
      default: return fail("not_yet", "Bolt doesn't know that move yet.");
    }
  }

  /* ---------- the interpreter ---------- */
  /** One step at a time: { kind:"highlight", blockId } for loops, ifs and My blocks, and { kind:"action", block } for a
      move (the caller performs it and sends the result back with next(result)). */
  function* run(blocks, program, world, counter, depth) {
    counter = counter || { steps: 0 };
    depth = depth || 0;
    for (const block of blocks || []) {
      if (++counter.steps > MAX_STEPS) throw new KidFriendlyError("too_many_steps", block.id, "Bolt got tired! Try a shorter program or use a loop.");
      switch (block.type) {
        case "repeat": {
          yield { kind: "highlight", blockId: block.id };
          for (let i = 0; i < (block.times | 0); i++) yield* run(block.body, program, world, counter, depth);
          break;
        }
        case "repeat_until": {
          yield { kind: "highlight", blockId: block.id };
          const cap = block.maxLoops || DEFAULT_MAX_LOOPS;
          let loops = 0;
          while (!world.check(block.cond)) {
            if (++loops > cap) throw new KidFriendlyError("loop_never_ends", block.id, "This loop never stopped. What should Bolt look for to stop?");
            yield* run(block.body, program, world, counter, depth);
          }
          break;
        }
        case "if": {
          yield { kind: "highlight", blockId: block.id };
          yield* run(world.check(block.cond) ? block.then : (block.else || []), program, world, counter, depth);
          break;
        }
        case "call": {
          if (depth >= MAX_CALL_DEPTH) throw new KidFriendlyError("too_deep", block.id, "My block is calling itself too much!");
          const body = program && program.myBlocks && program.myBlocks[block.name];
          if (!body) throw new KidFriendlyError("missing_block", block.id, "I can't find that My block.");
          yield { kind: "highlight", blockId: block.id };
          yield* run(body, program, world, counter, depth + 1);
          break;
        }
        default: {
          const result = yield { kind: "action", block };
          if (result && !result.ok) throw new KidFriendlyError(result.reason, block.id, result.message);
        }
      }
    }
  }

  /** Run a whole program on a fresh world from the level (for tests and the "solve" check). Returns
      { state:"won"|"failed", world, error, actions } and is the same every time for the same level and program. */
  function runAll(level, program) {
    const world = new World(level);
    const gen = run(program.main, program, world);
    const actions = [];
    let result, error = null;
    try {
      for (let step = gen.next(); !step.done; step = gen.next(result)) {
        result = undefined;
        if (step.value.kind === "action") { result = perform(step.value.block, world); actions.push({ id: step.value.block.id, ok: result.ok, at: world.snapshot() }); }
      }
      if (world.air && !world.settle()) error = new KidFriendlyError("fell", null, FELL().message);
    } catch (e) { error = e instanceof KidFriendlyError ? e : new KidFriendlyError("oops", null, "Something went wrong. Try again!"); }
    return { state: !error && world.atGoal() ? "won" : "failed", world, error, actions };
  }

  /** How many blocks a program uses (loops count as one, plus what they hold), for the "few blocks" star. */
  function countBlocks(blocks) {
    let n = 0;
    for (const b of blocks || []) { n++; if (b.body) n += countBlocks(b.body); if (b.then) n += countBlocks(b.then); if (b.else) n += countBlocks(b.else); }
    return n;
  }

  /* ---------- the Python preview (Inventors) ---------- */
  const PY_NAMES = { walk: (b) => "walk_" + (b.dir || "right") + "()", jump: (b) => "jump(\"" + (b.dir || "right") + "\")", fly: (b) => "fly_up(" + (b.feet || 1) + ")",
    rocket: () => "rocket_burst()", mode: (b) => b.mode + "_on()", stairs: () => "climb_stairs()", ladder: (b) => "climb_ladder_" + (b.dir || "up") + "()",
    grab: () => "grab_switch()", magnet: (b) => "magnet_" + (b.on ? "on" : "off") + "()", shrink: (b) => (b.on ? "shrink" : "grow") + "()",
    glide: () => "glide()", push: () => "push()", pull: () => "pull()", float: (b) => "float_" + (b.on ? "on" : "off") + "()", scan: () => "scan()",
    wait: (b) => "wait(" + (b.ticks || 1) + ")", call: (b) => (b.name || "my_block") + "()" };
  /** Read-only Python for the blocks, one line per block, with the block id for each line (to highlight the running one). */
  function toPython(program) {
    const lines = [];
    const emit = (blocks, ind) => {
      if (!blocks || !blocks.length) { lines.push({ text: ind + "pass", id: null }); return; }
      for (const b of blocks) {
        if (b.type === "repeat") { lines.push({ text: ind + "for i in range(" + (b.times | 0) + "):", id: b.id }); emit(b.body, ind + "    "); }
        else if (b.type === "repeat_until") { lines.push({ text: ind + "while not " + b.cond + "():", id: b.id }); emit(b.body, ind + "    "); }
        else if (b.type === "if") { lines.push({ text: ind + "if " + b.cond + "():", id: b.id }); emit(b.then, ind + "    "); if (b.else && b.else.length) { lines.push({ text: ind + "else:", id: b.id }); emit(b.else, ind + "    "); } }
        else lines.push({ text: ind + (PY_NAMES[b.type] ? PY_NAMES[b.type](b) : b.type + "()"), id: b.id });
      }
    };
    for (const name of Object.keys((program && program.myBlocks) || {})) { lines.push({ text: "def " + name + "():", id: null }); emit(program.myBlocks[name], "    "); lines.push({ text: "", id: null }); }
    emit(program && program.main, "");
    return lines;
  }

  root.BoltCourse = { World, perform, run, runAll, countBlocks, toPython, KidFriendlyError,
    MAX_STEPS, DEFAULT_MAX_LOOPS, MAX_CALL_DEPTH, BATTERY_FULL, JUMP_FT, FLY_MAX };
})(typeof window !== "undefined" ? window : globalThis);
