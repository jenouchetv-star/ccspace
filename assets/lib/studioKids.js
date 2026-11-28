/* Chike's Creative Space - each child's own space in the Studio apps (owner, 2026-11-28: "make the Creative Space studio
   apps save files based on the child that's using it so that the child can have their own space but share usage";
   draft docs/mockups/studio-per-child-draft.html, approved for Sound Space and Art Space, "keep this concept for
   future apps").

   A saved song or picture carries `child`: the id of the child it belongs to, or "" for the Family shelf (work saved
   before children had spaces, and what a grown-up makes). The app shows the picked child's shelf, with the Family
   shelf under it; a "Move to" button puts a Family shelf file in a child's space. The family's limits are shared:
   one space for everyone, its bar split by child.

   Who is making comes from the site (studioFamily / studioPick on the page that opened the app), the same pick as
   "Who's creating today?". A family with no children, a visitor who isn't signed in, and the app opened on its own
   work as before: one shelf, no chip.

   Classic script: sets window.StudioKids. The pure helpers are tested in test/studioKids.test.js. */
(function (root) {
  const COLORS = ["#8B5CF6", "#F59E0B", "#10B981", "#EC4899", "#3B82F6", "#EF4444"];
  const FAMILY_COLOR = "#64748B";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /** A child id as files keep it: letters, digits and dashes, at most 64. Anything else: "" (the Family shelf). */
  function cleanChild(v) { return typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v) ? v : ""; }
  /** The shelf a file is on: its child when that child is in the family, else the Family shelf (""). */
  function shelfOf(child, kids) { const c = cleanChild(child); return c && (kids || []).some((k) => k.id === c) ? c : ""; }
  /** The files on one shelf. `get(item)` reads an item's child. */
  function onShelf(items, shelf, kids, get) { return (items || []).filter((it) => shelfOf(get(it), kids) === shelf); }
  /** How many files each shelf has: { "": n, <child id>: n, ... }. */
  function counts(items, kids, get) {
    const m = { "": 0 };
    (kids || []).forEach((k) => { m[k.id] = 0; });
    (items || []).forEach((it) => { m[shelfOf(get(it), kids)]++; });
    return m;
  }
  /** A child's color in the space bar (the family's order), or the Family shelf's gray. */
  function colorOf(shelf, kids) { const i = (kids || []).findIndex((k) => k.id === shelf); return i < 0 ? FAMILY_COLOR : COLORS[i % COLORS.length]; }
  /** The space bar's pieces from the server's byChild ([{ child, items, bytes }]): one per child in the family's
      order, then the Family shelf (with files of children no longer in the family). Empty pieces are left out. */
  function segments(byChild, kids, key) {
    const sum = { "": 0 };
    (kids || []).forEach((k) => { sum[k.id] = 0; });
    (byChild || []).forEach((r) => { sum[shelfOf(r && r.child, kids)] += Number(r && r[key]) || 0; });
    return (kids || []).map((k) => k.id).concat([""]).filter((s) => sum[s] > 0).map((s) => ({ shelf: s, color: colorOf(s, kids), value: sum[s] }));
  }
  /** "Maya’s" */
  function possessive(name) { return String(name || "") + "’s"; }
  /** "Maya", "Maya and Leo", "Maya, Leo and Ava" */
  function joinNames(names) {
    const n = (names || []).filter(Boolean);
    return n.length < 3 ? n.join(" and ") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
  }
  /** What the app shows from the site's answer: null when there's no one to pick (one shelf, as before), "" for the
      Family shelf ("Just me, the grown-up"), a child's id, or undefined when the app should ask first. */
  function pickedShelf(fam) {
    const kids = fam && Array.isArray(fam.kids) ? fam.kids : [];
    if (!kids.length) return null;
    if (fam.picked === "grownup") return "";
    return kids.some((k) => k.id === fam.picked) ? fam.picked : undefined;
  }
  /** "1 song", "4 songs", "1 picture" */
  function countText(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* ---------- the parts on screen ---------- */
  const CSS = `
  .sk-who{ display:inline-flex; align-items:center; gap:8px; height:34px; padding:0 10px 0 4px; margin-left:auto; border-radius:999px; border:1px solid var(--btn-edge, var(--border, #3A3A44)); background:var(--card-a, var(--surface, #26262C)); color:inherit; font:inherit; font-weight:700; cursor:pointer; white-space:nowrap; }
  .sk-who--ask{ padding-left:12px; }
  .sk-who svg.sk-chev{ width:16px; height:16px; opacity:.7; }
  .sk-who:focus-visible, .sk-menu button:focus-visible, .sk-ask button:focus-visible{ outline:2px solid var(--accent, #8B5CF6); outline-offset:2px; }
  .sk-av{ border-radius:50%; flex:none; object-fit:cover; display:inline-grid; place-items:center; color:#fff; font-weight:800; }
  .sk-menu{ position:fixed; z-index:80; width:300px; max-width:calc(100vw - 24px); padding:8px; border-radius:14px; background:var(--card-a, var(--surface, #26262C)); color:var(--text, inherit); border:1px solid var(--btn-edge, var(--border, #3A3A44)); box-shadow:0 18px 40px rgba(0,0,0,.45); }
  .sk-menu h4{ margin:6px 8px 8px; font-size:12px; color:var(--mute, #A1A1AB); font-weight:700; }
  .sk-menu button{ width:100%; display:flex; align-items:center; gap:10px; padding:8px; border:0; border-radius:10px; background:none; color:inherit; font:inherit; text-align:left; cursor:pointer; }
  .sk-menu button:hover{ background:var(--well, var(--surface-2, rgba(255,255,255,.06))); }
  .sk-menu button[aria-checked="true"]{ background:var(--accent-weak, rgba(139,92,246,.18)); }
  .sk-menu b{ display:block; font-size:14px; } .sk-menu small{ display:block; color:var(--mute, #A1A1AB); font-size:12px; }
  .sk-menu .sk-n{ margin-left:auto; color:var(--mute, #A1A1AB); font-size:12px; font-weight:700; white-space:nowrap; }
  .sk-fam{ width:36px; height:36px; border-radius:50%; display:grid; place-items:center; background:#334155; color:#E2E8F0; flex:none; }
  .sk-fam svg{ width:18px; height:18px; }
  .sk-menu p{ margin:6px 8px 4px; font-size:12px; color:var(--mute, #A1A1AB); }
  .sk-stack{ display:flex; height:8px; border-radius:99px; overflow:hidden; background:var(--well, var(--surface-2, #1E1E23)); box-shadow:var(--press, inset 0 0 0 1px var(--border, transparent)); }
  .sk-stack i{ display:block; height:100%; }
  .sk-key{ display:flex; flex-wrap:wrap; gap:4px 14px; font-size:12px; color:var(--mute, #A1A1AB); }
  .sk-key span{ display:inline-flex; align-items:center; gap:6px; } .sk-key i{ width:10px; height:10px; border-radius:3px; display:inline-block; }
  .sk-famshelf{ margin-top:28px; padding-top:18px; border-top:1px dashed var(--btn-edge, var(--border, #3A3A44)); }
  .sk-famshelf h2{ margin:0 0 4px; } .sk-famshelf > p{ margin:0 0 14px; color:var(--mute, #A1A1AB); }
  .sk-move{ height:28px; padding:0 9px; font-size:12px; gap:5px; display:inline-flex; align-items:center; flex:none; }
  .sk-move svg{ width:14px; height:14px; }
  .sk-ask{ position:fixed; inset:0; z-index:90; display:grid; place-items:center; padding:16px; background:rgba(10,10,14,.72); }
  .sk-ask .sk-box{ width:min(560px,100%); padding:26px; border-radius:20px; background:var(--card-a, var(--surface, #26262C)); color:var(--text, inherit); border:1px solid var(--btn-edge, var(--border, #3A3A44)); text-align:center; box-shadow:0 24px 60px rgba(0,0,0,.5); }
  .sk-ask h2{ margin:0 0 4px; font-size:24px; } .sk-ask .sk-box > p{ margin:0 0 18px; color:var(--mute, #A1A1AB); font-size:14px; }
  .sk-kids{ display:flex; justify-content:center; flex-wrap:wrap; gap:16px; margin-bottom:16px; }
  .sk-kid{ width:130px; padding:14px 8px; border-radius:16px; border:1px solid var(--btn-edge, var(--border, #3A3A44)); background:var(--well, var(--surface-2, #1E1E23)); color:inherit; font:inherit; cursor:pointer; }
  .sk-kid .sk-av{ margin:0 auto 8px; display:grid; }
  .sk-kid b{ display:block; font-size:16px; } .sk-kid small{ color:var(--mute, #A1A1AB); }
  .sk-grown{ border:0; background:none; color:var(--mute, #A1A1AB); font:inherit; font-weight:700; text-decoration:underline; cursor:pointer; }
  @media (max-width:560px){ .sk-who .sk-name{ display:none; } }
  /* loading (owner, 2026-11-28): files from the account show at once as cards still loading, and fill in one by one */
  .sk-pending .art__open{ position:relative; overflow:hidden; cursor:progress; }
  .sk-pending .art__open > img, .sk-pending .art__open > svg{ opacity:.45; filter:saturate(.5); }
  .sk-pending .art__open::after{ content:""; position:absolute; inset:0; background:linear-gradient(100deg, transparent 20%, rgba(255,255,255,.14) 50%, transparent 80%); background-size:250% 100%; animation:skShimmer 1.6s ease-in-out infinite; }
  .sk-pending .art__name{ color:var(--mute, #A1A1AB); }
  .sk-ghost .art__open{ min-height:120px; }
  .sk-ghost .sk-line{ display:block; height:10px; border-radius:6px; background:var(--well, var(--surface-2, rgba(255,255,255,.08))); width:70%; margin:4px 0; }
  .sk-ghost .sk-line + .sk-line{ width:40%; }
  .sk-arrive{ animation:skIn .5s cubic-bezier(.2,.7,.3,1) both; }
  .sk-note{ display:inline-flex; align-items:center; gap:8px; margin-left:12px; font-size:12.5px; font-weight:500; color:var(--mute, #A1A1AB); vertical-align:middle; }
  .sk-note i{ width:12px; height:12px; border-radius:50%; border:2px solid currentColor; border-right-color:transparent; animation:skSpin .9s linear infinite; }
  @keyframes skShimmer{ from{ background-position:120% 0; } to{ background-position:-20% 0; } }
  @keyframes skIn{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
  @keyframes skSpin{ to{ transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce){ .sk-pending .art__open::after, .sk-arrive{ animation:none; } .sk-note i{ animation-duration:2.4s; } }
  `;
  const ICON = {
    chev: '<svg class="sk-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>',
    move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 21a8 8 0 0 1 13.29-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6M22 19h-6"/></svg>'
  };
  /** A child's picture: their avatar, or their first letter on their color. */
  function avatarHTML(k, size, kids) {
    if (k && k.avatar) return '<img class="sk-av" src="' + esc(k.avatar) + '" alt="" width="' + size + '" height="' + size + '" style="width:' + size + 'px;height:' + size + 'px;background:#1E2226">';
    return '<span class="sk-av" aria-hidden="true" style="width:' + size + 'px;height:' + size + 'px;background:' + colorOf(k && k.id, kids) + ';font-size:' + Math.round(size * 0.45) + 'px">' + esc(String((k && k.name) || "?").slice(0, 1).toUpperCase()) + '</span>';
  }

  /** The app's side of it. o: { doc, host() -> the site window or null, one:"song", many:"songs", own:"songs"
      (as in "Maya’s songs"), onChange(shelf) } */
  function create(o) {
    const doc = o.doc;
    const state = { kids: [], shelf: null, loaded: false };
    let chip = null, menu = null, ask = null;
    function style() {
      if (doc.getElementById("sk-css")) return;
      const s = doc.createElement("style"); s.id = "sk-css"; s.textContent = CSS; doc.head.appendChild(s);
    }
    const kidOf = (id) => state.kids.find((k) => k.id === id) || null;
    /** Ask the site who's in the family and who's making. Nothing to ask (no site, signed out, no children): one shelf. */
    async function load() {
      const before = JSON.stringify([state.kids, state.shelf]);
      let fam = null;
      try { const w = o.host(); if (w && typeof w.studioFamily === "function") fam = await w.studioFamily(); } catch (e) { fam = null; }
      state.kids = fam && Array.isArray(fam.kids) ? fam.kids.filter((k) => k && cleanChild(k.id)) : [];
      state.shelf = pickedShelf({ kids: state.kids, picked: fam && fam.picked });
      state.loaded = true;
      paintChip();
      return JSON.stringify([state.kids, state.shelf]) !== before;
    }
    function pick(shelf) {
      state.shelf = shelf;
      try { const w = o.host(); if (w && typeof w.studioPick === "function") w.studioPick(shelf === "" ? "grownup" : shelf); } catch (e) {}
      closeMenu(); closeAsk(); paintChip();
      if (o.onChange) o.onChange(shelf);
    }
    function paintChip() {
      style();
      const bar = o.bar && o.bar();
      if (!state.kids.length || !bar) { if (chip) { chip.remove(); chip = null; } return; }
      if (!chip) {
        chip = doc.createElement("button"); chip.type = "button"; chip.className = "sk-who";
        chip.setAttribute("aria-haspopup", "menu"); chip.setAttribute("aria-expanded", "false");
        chip.addEventListener("click", (e) => { e.stopPropagation(); menu ? closeMenu() : openMenu(); });
        if (o.place) o.place(bar, chip); else bar.appendChild(chip);
      }
      const k = kidOf(state.shelf);
      chip.classList.toggle("sk-who--ask", state.shelf === undefined);
      chip.innerHTML = state.shelf === undefined ? '<span class="sk-name">Who’s making?</span>' + ICON.chev
        : k ? avatarHTML(k, 26, state.kids) + '<span class="sk-name">' + esc(k.name) + '</span>' + ICON.chev
        : '<span class="sk-fam" style="width:26px;height:26px">' + ICON.users + '</span><span class="sk-name">Family shelf</span>' + ICON.chev;
      chip.setAttribute("aria-label", "Who’s making: " + (k ? k.name : state.shelf === "" ? "Family shelf" : "nobody picked yet"));
    }
    function openMenu() {
      closeMenu();
      const n = o.counts ? o.counts() : {};
      menu = doc.createElement("div"); menu.className = "sk-menu"; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Who’s making?");
      const row = (shelf, pic, name, sub) => '<button type="button" role="menuitemradio" aria-checked="' + (state.shelf === shelf) + '" data-sk-pick="' + esc(shelf) + '">' + pic
        + '<span><b>' + esc(name) + '</b><small>' + esc(sub) + '</small></span><span class="sk-n">' + countText(n[shelf] || 0, o.one, o.many) + '</span></button>';
      menu.innerHTML = '<h4>Who’s making?</h4>'
        + state.kids.map((k) => row(k.id, avatarHTML(k, 36, state.kids), k.name, k.grade || "")).join("")
        + row("", '<span class="sk-fam">' + ICON.users + '</span>', "Family shelf", "Shared by everyone")
        + '<p>Changing it here also changes who’s creating on the site.</p>';
      doc.body.appendChild(menu);
      const r = chip.getBoundingClientRect();
      menu.style.top = Math.round(r.bottom + 6) + "px";
      menu.style.right = Math.max(12, Math.round(doc.documentElement.clientWidth - r.right)) + "px";
      chip.setAttribute("aria-expanded", "true");
      menu.addEventListener("click", (e) => { const b = e.target.closest("[data-sk-pick]"); if (b) pick(b.getAttribute("data-sk-pick")); });
      const first = menu.querySelector('[aria-checked="true"]') || menu.querySelector("button");
      if (first) first.focus();
    }
    function closeMenu() { if (menu) { menu.remove(); menu = null; if (chip) chip.setAttribute("aria-expanded", "false"); } }
    /** "Who's making today?" when there are children and nobody is picked yet (once each time the app opens). */
    function askIfNeeded() {
      if (!state.kids.length || state.shelf !== undefined || ask) return false;
      style();
      ask = doc.createElement("div"); ask.className = "sk-ask"; ask.setAttribute("role", "dialog"); ask.setAttribute("aria-modal", "true"); ask.setAttribute("aria-labelledby", "sk-ask-t");
      ask.innerHTML = '<div class="sk-box"><h2 id="sk-ask-t">Who’s making today?</h2><p>Your ' + esc(o.many) + ' save to your own space.</p><div class="sk-kids">'
        + state.kids.map((k) => '<button type="button" class="sk-kid" data-sk-pick="' + esc(k.id) + '">' + avatarHTML(k, 80, state.kids) + '<b>' + esc(k.name) + '</b><small>' + esc(k.grade || "") + '</small></button>').join("")
        + '</div><button type="button" class="sk-grown" data-sk-pick="">Just me, the grown-up (saves to the Family shelf)</button></div>';
      doc.body.appendChild(ask);
      ask.addEventListener("click", (e) => { const b = e.target.closest("[data-sk-pick]"); if (b) pick(b.getAttribute("data-sk-pick")); });
      const first = ask.querySelector("button"); if (first) first.focus();
      return true;
    }
    function closeAsk() { if (ask) { ask.remove(); ask = null; } }
    /** A small menu of the children, next to a Move to button. Resolves to the child's id, or null when closed. */
    function moveMenu(anchor) {
      closeMenu();
      return new Promise((done) => {
        menu = doc.createElement("div"); menu.className = "sk-menu"; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Move to");
        menu.innerHTML = '<h4>Move to</h4>' + state.kids.map((k) => '<button type="button" role="menuitem" data-sk-to="' + esc(k.id) + '">' + avatarHTML(k, 32, state.kids)
          + '<span><b>' + esc(possessive(k.name)) + ' space</b><small>' + esc(k.grade || "") + '</small></span></button>').join("");
        doc.body.appendChild(menu);
        const r = anchor.getBoundingClientRect(), h = menu.offsetHeight, vh = doc.documentElement.clientHeight;
        menu.style.top = Math.round(r.bottom + 6 + h > vh ? Math.max(12, r.top - 6 - h) : r.bottom + 6) + "px";
        menu.style.left = Math.round(Math.min(Math.max(12, r.left), doc.documentElement.clientWidth - menu.offsetWidth - 12)) + "px";
        let settled = false;
        const finish = (v) => { if (settled) return; settled = true; closeMenu(); doc.removeEventListener("click", away, true); done(v); };
        const away = (e) => { if (!menu || !menu.contains(e.target)) finish(null); };
        menu.addEventListener("click", (e) => { const b = e.target.closest("[data-sk-to]"); if (b) finish(b.getAttribute("data-sk-to")); });
        setTimeout(() => doc.addEventListener("click", away, true), 0);
        const first = menu.querySelector("button"); if (first) first.focus();
      });
    }
    doc.addEventListener("click", (e) => { if (menu && !menu.contains(e.target) && e.target !== chip && !(chip && chip.contains(e.target))) closeMenu(); });
    doc.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu) { closeMenu(); if (chip) chip.focus(); } });
    return {
      load, pick, askIfNeeded, moveMenu, paintChip,
      get on() { return state.kids.length > 0; },
      /** the family has been asked at least once (until then the shelves aren't known) */
      get loaded() { return state.loaded; },
      get kids() { return state.kids; },
      /** the shelf shown: a child's id, "" for the Family shelf, undefined while asking, null when there's one shelf */
      get shelf() { return state.shelf; },
      /** the child new files belong to: the picked child, else "" */
      get child() { return state.kids.length && state.shelf ? state.shelf : ""; },
      kid: kidOf,
      /** the line under New */
      lede(start) {
        const k = kidOf(state.shelf);
        if (state.shelf === undefined) return "Pick who’s making, and their " + o.many + " show here.";
        if (k) return start + " " + possessive(k.name) + " " + o.own + " save" + (o.ownOne ? "s" : "") + " to " + possessive(k.name) + " space in your family account.";
        return start + " " + o.own.charAt(0).toUpperCase() + o.own.slice(1) + " you make now save" + (o.ownOne ? "s" : "") + " to the Family shelf, shared by everyone.";
      },
      /** the heading over the shelf shown */
      heading() { const k = kidOf(state.shelf); return k ? possessive(k.name) + " " + o.own : "Family shelf"; },
      /** the Family shelf under a child's shelf */
      familyShelfHTML(cards) {
        return '<section class="sk-famshelf" aria-labelledby="sk-fam-t"><h2 id="sk-fam-t">Family shelf</h2><p>' + esc(o.Many) + ' saved before each child had their own space, and what grown-ups make. Everyone in the family can open them. Move one to a child’s space to keep it there.</p>'
          + cards + '</section>';
      },
      /** cards that stand in while the family is still being asked: no files shown yet, so no one sees a sibling's */
      ghostCardsHTML(n) {
        return Array.from({ length: n || 3 }, () => '<article class="art sk-pending sk-ghost" aria-hidden="true"><span class="art__open"></span><div class="art__body"><span class="art__name"><span class="sk-line"></span><span class="sk-line"></span></span></div></article>').join("");
      },
      /** "Getting 8 songs from your account" beside the shelf's heading while files come down */
      noteHTML(n) { return n > 0 ? '<span class="sk-note" role="status"><i aria-hidden="true"></i>Getting ' + countText(n, o.one, o.many) + ' from your account</span>' : ""; },
      moveButtonHTML(id, title) { return '<button type="button" class="btn sk-move" data-sk-move="' + esc(id) + '" aria-label="Move ' + esc(title) + ' to a child’s space">' + ICON.move + 'Move to</button>'; },
      /** the family space bar: shared by the children, split by child */
      spaceHTML(u) {
        const items = segments(u.byChild, state.kids, "items"), bytes = segments(u.byChild, state.kids, "bytes");
        const bar = (segs, max, label) => '<div class="sk-stack" role="img" aria-label="' + esc(label) + '">' + segs.map((s) => '<i style="width:' + Math.min(100, s.value / max * 100).toFixed(1) + '%;background:' + s.color + '"></i>').join("") + '</div>';
        const mb = (v) => (Math.round(v / 100000) / 10).toFixed(1);
        return '<span class="space__icon">' + ICON.users + '</span><div class="space__main">'
          + '<div class="space__line"><span class="space__title"><b>Family space</b>&nbsp;&middot; shared by ' + esc(joinNames(state.kids.map((k) => k.name))) + '</span>'
          + '<span><b>' + u.items + '</b> of ' + u.maxItems + ' ' + esc(o.many) + ' &middot; <b>' + mb(u.bytes) + ' MB</b> of ' + Math.round(u.maxBytes / 1000000) + ' MB</span></div>'
          + '<div class="space__bars">' + bar(items, u.maxItems, o.Many + " used, by child") + bar(bytes, u.maxBytes, "Space used, by child") + '</div>'
          + '<div class="sk-key">' + state.kids.map((k) => '<span><i style="background:' + colorOf(k.id, state.kids) + '"></i>' + esc(k.name) + '</span>').join("")
          + '<span><i style="background:' + FAMILY_COLOR + '"></i>Family shelf</span></div>'
          + (u.note ? '<div class="space__note">' + esc(u.note) + '</div>' : "")
          + '</div>';
      }
    };
  }

  root.StudioKids = { cleanChild, shelfOf, onShelf, counts, colorOf, segments, possessive, joinNames, pickedShelf, countText, create, FAMILY_COLOR, COLORS };
})(typeof window !== "undefined" ? window : globalThis);
