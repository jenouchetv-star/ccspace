# Admin Book Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 9 hand-coded static book HTML files with one data-driven reader, and give admins a visual page builder (add/move pages, freeform text layers with lock/z-order, preset-placed images, color/gradient/image/GIF backgrounds) to edit story content that today can only be changed by hand-editing HTML.

**Architecture:** Story pages become a `pages` array on the `stories` Supabase record (`{background, layers:[...]}` per page, percentage-based coordinates). A new admin screen at `#/admin/stories/:id/build` edits that array directly against `db.update()`. A new generic `books/reader.html` fetches a story's `pages` by id and renders the same flip-book DOM/CSS/JS every existing book already uses, just built from data instead of hardcoded markup. The 9 existing books are migrated into this format by a one-time parser and then their static files are deleted.

**Tech Stack:** Vanilla JS (no build step), the existing `index.html` SPA's own conventions (`db`/`ACTIONS`/`AppState`/`.admin-*` CSS, `uid()`, `E()`, `ic()`), Supabase Postgres (`jsonb` column), a standalone Node parsing script (no new npm dependencies, matching `supabase/seed-supabase.mjs`'s existing style).

**Reference:** Full design rationale in `docs/superpowers/specs/2026-09-07-book-builder-design.md`.

---

## Task 1: Data model helpers and pure tests

**Files:**
- Modify: `index.html:5661` (right after `findBook`) — add helper functions
- Modify: `index.html:9303` (`BLANKS.stories`) — add `pages:[]`
- Modify: `index.html:13162` area (`TEST_SUITE`) — add a new "Story pages" group

- [ ] **Step 1: Add the page/layer factory functions**

Insert immediately after `const findBook = id => BOOKS.find(b => b.id === id) || null;` at `index.html:5661`:

```js
/* A book page = one background fill + an ordered stack of layers drawn on
   top of it (array order IS z-order, bottom to top). Coordinates on a
   layer are percentages of the page box, not pixels - the page box itself
   already scales as one unit at every size (the thumbnail modal proves
   this today, rendering pages at transform:scale(0.2)), so percentage
   layers scale for free the same way a PowerPoint/Canva slide does. */
function blankBookPage(){
  return { id: uid("pg"), background: { type:"color", value:"#FDECEA" }, layers: [] };
}
function blankTextLayer(){
  return { id: uid("ly"), type:"text", content:"New text", x:10, y:40, w:80, h:20,
    style:"body", align:"left", color:"", locked:false };
}
function blankImageLayer(src, alt){
  return { id: uid("ly"), type:"image", src: src || "", alt: alt || "", placement:"inset-center" };
}
/* "c1,c2,angle" - kept as one string (not three fields) so it round-trips
   through a single text/color input pair in the builder without a bespoke
   three-part form control. */
function bgToCSS(bg){
  if (!bg) return "background-color:#FFF6E2";
  if (bg.type === "color") return "background-color:" + (bg.value || "#FFF6E2");
  if (bg.type === "gradient"){
    const parts = String(bg.value || "").split(",");
    const c1 = parts[0] || "#8C2620", c2 = parts[1] || "#5E1712", angle = parts[2] || "160";
    return "background-image:linear-gradient(" + angle + "deg, " + c1 + " 0%, " + c2 + " 100%)";
  }
  if (bg.type === "image" || bg.type === "gif"){
    return "background-image:url('" + String(bg.value || "").replace(/'/g, "%27") + "');"
      + "background-size:cover;background-position:center";
  }
  return "background-color:#FFF6E2";
}
```

- [ ] **Step 2: Add `pages:[]` to the story blank record**

In `BLANKS.stories` at `index.html:9303`, change:

```js
  stories:    () => ({ title:"", slug:"", character:"chike", readMinutes:5, ageMin:4, ageMax:9, blurb:"", opening:"", learning:"", value:"kindness", linkedActivity:"", image:{src:"",alt:""}, status:"draft", featured:false }),
```

to:

```js
  stories:    () => ({ title:"", slug:"", character:"chike", readMinutes:5, ageMin:4, ageMax:9, blurb:"", opening:"", learning:"", value:"kindness", linkedActivity:"", image:{src:"",alt:""}, status:"draft", featured:false, pages:[] }),
```

- [ ] **Step 3: Add pure tests for the factory functions**

Add a new group right after the last `Database` entry, before the `/* ---------- CRUD ---------- */` comment at `index.html:13198` (i.e. insert these two entries just before that comment):

```js
  /* ---------- Story pages ---------- */
  { group:"Story pages", name:"A blank page has a background and no layers", blocking:false, run(){
    const p = blankBookPage();
    const ok = p.background && p.background.type === "color" && Array.isArray(p.layers) && p.layers.length === 0;
    return ok ? T.pass("Blank page created") : T.fail("Unexpected shape: " + JSON.stringify(p));
  }},
  { group:"Story pages", name:"A blank text layer stays within the page's percentage bounds and starts unlocked", blocking:false, run(){
    const ly = blankTextLayer();
    const inBounds = ly.x >= 0 && ly.x <= 100 && ly.y >= 0 && ly.y <= 100 && ly.w > 0 && ly.w <= 100 && ly.h > 0 && ly.h <= 100;
    return (inBounds && ly.locked === false && ly.type === "text")
      ? T.pass("Text layer created")
      : T.fail("Unexpected shape: " + JSON.stringify(ly));
  }},
  { group:"Story pages", name:"bgToCSS renders all four background types without throwing", blocking:false, run(){
    const kinds = [
      { type:"color", value:"#FDECEA" },
      { type:"gradient", value:"#8C2620,#5E1712,160" },
      { type:"image", value:"/assets/characters/zech.jpg" },
      { type:"gif", value:"/assets/characters/zech.gif" }
    ];
    const outputs = kinds.map(bgToCSS);
    const allStrings = outputs.every(o => typeof o === "string" && o.length > 0);
    const gradientHasAngle = outputs[1].indexOf("160deg") >= 0;
    return (allStrings && gradientHasAngle) ? T.pass("All four backgrounds rendered") : T.fail("Got: " + JSON.stringify(outputs));
  }},
```

- [ ] **Step 4: Verify with `node --check`**

Extract the inline `<script>` block and check syntax (this project's established verification step):

```bash
node --check index.html
```

Note: if `index.html` is not directly `node --check`-able because it's HTML, extract the largest `<script>...</script>` block to a temp `.js` file first, matching this session's established workflow, then `node --check` that file.

Expected: no output (syntax OK).

- [ ] **Step 5: Run `/test` in the browser and confirm the new group passes**

Open `#/test` in the running site, click "Run all checks," confirm three new "Story pages" entries appear and all pass, and the existing baseline count doesn't otherwise change.

- [ ] **Step 6: Document the new field shape in `migration.sql`**

No schema change is needed - `stories.data` is already `jsonb`, and `pages` is just a new key inside it - but add a comment near the `stories` table's definition in `supabase/migration.sql` so a future reader knows the shape exists without having to find it in `index.html`:

```sql
-- stories.data also carries an optional "pages" array as of the admin
-- book builder (see docs/superpowers/specs/2026-09-07-book-builder-design.md):
--   pages: [{ id, background:{type,value}, layers:[{id,type,...}] }, ...]
-- No column change needed - this is just documentation for a key inside
-- the existing jsonb "data" column.
```

- [ ] **Step 7: Commit**

```bash
git add index.html supabase/migration.sql
git commit -m "Add story-page/layer data model helpers and pure tests"
```

---

## Task 2: Route, admin dispatch, builder entry point

**Files:**
- Modify: `index.html:5816` (`parseRoute`)
- Modify: `index.html:15210` (`renderRoute`'s admin case)
- Modify: `index.html:12255` (`viewAdmin` signature + dispatch)
- Modify: `index.html:5597` (`AppState.admin`)
- Modify: `index.html:9437` (`openEditor`'s modal footer)
- Modify: `index.html:15308` (`ACTIONS`)

- [ ] **Step 1: Let the admin route carry a fourth segment**

In `parseRoute` at `index.html:5816`, change:

```js
  if (seg[0] === "admin") return { name:"admin", params:{ section: seg[1] || "dashboard", id: seg[2] || "" }, query:query };
```

to:

```js
  if (seg[0] === "admin") return { name:"admin", params:{ section: seg[1] || "dashboard", id: seg[2] || "", sub: seg[3] || "" }, query:query };
```

- [ ] **Step 2: Pass it through to `viewAdmin`**

In `renderRoute` at `index.html:15210`, change:

```js
    case "admin":             return viewAdmin(p.section === "dashboard" || !p.section ? "dashboard" : p.section, p.id);
```

to:

```js
    case "admin":             return viewAdmin(p.section === "dashboard" || !p.section ? "dashboard" : p.section, p.id, p.sub);
```

- [ ] **Step 3: Dispatch to the builder before the generic content-list fallback**

In `viewAdmin` at `index.html:12255`, change the function signature:

```js
function viewAdmin(section, id){
```

to:

```js
function viewAdmin(section, id, sub){
```

Then, right before the `else if (CONTENT_COLS.indexOf(section) >= 0) body = adminList(section);` line (`index.html:12318`), insert:

```js
  else if (section === "stories" && id && sub === "build") body = adminStoryBuilder(id);
```

(`adminStoryBuilder` is created in Task 3 — for this step, add a temporary one-line stub right after `viewAdmin`'s closing brace so the app doesn't throw a "not defined" error between now and Task 3:)

```js
function adminStoryBuilder(id){
  return '<section class="section"><div class="shell"><p class="tiny mute">Book builder for story ' + E(id) + ' - coming in the next task.</p></div></section>';
}
```

- [ ] **Step 4: Add builder state to `AppState.admin`**

In `AppState.admin` at `index.html:5593-5598`, change:

```js
    lastNewsletterId:null,
    notifOpen:false },
```

to:

```js
    lastNewsletterId:null,
    storyBuilder:{ storyId:null, pages:null, selectedPageId:"", selectedLayerId:"", dirty:false },
    notifOpen:false },
```

(`pages:null` means "not loaded for the current story yet" - distinct from `[]`, which means "loaded, and genuinely empty." Task 3 uses this distinction to decide whether to (re)load from `db.find`.)

- [ ] **Step 5: Add the "Build pages" entry point to the story editor modal**

In `openEditor` at `index.html:9437-9439`, change:

```js
    + '<div class="modal__foot">'
    + '<button type="button" class="admin-btn admin-btn--ghost" data-act="close-modal">Cancel</button>'
    + '<button type="submit" class="admin-btn admin-btn--primary">' + ic("save") + ' Save</button>'
    + '</div></form></div>',
```

to:

```js
    + '<div class="modal__foot">'
    + (col === "stories" && id
        ? '<button type="button" class="admin-btn admin-btn--ghost" data-act="story-build-pages" data-id="' + E(id) + '">' + ic("layers") + ' Build pages</button>'
        : "")
    + '<button type="button" class="admin-btn admin-btn--ghost" data-act="close-modal">Cancel</button>'
    + '<button type="submit" class="admin-btn admin-btn--primary">' + ic("save") + ' Save</button>'
    + '</div></form></div>',
```

(Only shown for an *existing* story, since building pages needs a saved record to attach them to - a brand-new unsaved story has no `id` yet.)

- [ ] **Step 6: Wire the button's action**

In `ACTIONS` at `index.html:15308`, add (near the other `"close-modal"`/navigation-adjacent handlers, e.g. right after the `"go"` entry):

```js
  "story-build-pages": (el) => {
    const id = el.getAttribute("data-id");
    closeModal();
    navigate("#/admin/stories/" + id + "/build");
  },
```

- [ ] **Step 7: `node --check`, then manual browser verification**

```bash
node --check index.html
```

In the browser: open `/admin/stories`, edit any story, click "Build pages," confirm it navigates to `#/admin/stories/<id>/build` and the modal has closed (not still sitting open over the new page), and confirm the stub text renders with the correct story id. Also confirm ordinary story editing (Save/Cancel) still works unchanged.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "Add the /admin/stories/:id/build route and its entry point"
```

---

## Task 3: Builder shell + page filmstrip (list, add, duplicate, delete, reorder)

**Files:**
- Modify: `index.html` — replace the Task 2 stub `adminStoryBuilder(id)` with the real implementation; add new CSS; add new `ACTIONS` entries

- [ ] **Step 1: Replace the stub with the real builder shell**

Replace the temporary `adminStoryBuilder` from Task 2 with:

```js
function adminStoryBuilder(id){
  const story = db.find("stories", id);
  if (!story) return '<section class="section"><div class="shell"><div class="empty">'
    + '<h2>Story not found</h2><a class="admin-btn admin-btn--ghost" href="#/admin/stories">Back to Stories</a></div></div></section>';

  const sb = AppState.admin.storyBuilder;
  if (sb.storyId !== id){
    sb.storyId = id;
    sb.pages = (story.pages && story.pages.length) ? JSON.parse(JSON.stringify(story.pages)) : [blankBookPage()];
    sb.selectedPageId = sb.pages[0].id;
    sb.selectedLayerId = "";
    sb.dirty = false;
  }

  const page = sb.pages.find(p => p.id === sb.selectedPageId) || sb.pages[0];

  return '<section class="section admin-scope" style="font-family:var(--admin-font-body);color:var(--admin-ink)">'
    + '<div class="shell">'
    + '<div class="admin-topbar" style="margin-bottom:16px">'
    + '<div><span class="admin-eyebrow">Book builder</span>'
    + '<h1 class="admin-section-title" style="margin-top:2px">' + E(story.title || "Untitled story") + '</h1></div>'
    + '<div class="row" style="gap:10px">'
    + (sb.dirty ? '<span class="admin-badge admin-badge--warn">' + ic("pencil") + ' Unsaved</span>' : "")
    + '<button type="button" class="admin-btn admin-btn--ghost" data-act="story-build-close" data-id="' + E(id) + '">Close</button>'
    + '<button type="button" class="admin-btn admin-btn--primary" data-act="story-build-save" data-id="' + E(id) + '">' + ic("save") + ' Save</button>'
    + '</div></div>'
    + '<div class="story-builder">'
    + storyBuilderFilmstrip(sb)
    + storyBuilderCanvas(page)
    + storyBuilderLayersPanel(page)
    + '</div></div></section>';
}

function storyBuilderFilmstrip(sb){
  return '<div class="story-builder__filmstrip admin-card">'
    + '<div class="admin-hint" style="margin-bottom:10px">Pages</div>'
    + '<div class="story-builder__pagelist">'
    + sb.pages.map((p, i) => {
        const on = p.id === sb.selectedPageId;
        return '<div class="story-builder__pagethumb' + (on ? ' is-selected' : '') + '" draggable="true"'
          + ' data-act="story-build-select-page" data-page-id="' + E(p.id) + '">'
          + '<div class="story-builder__pagethumb-preview" style="' + E(bgToCSS(p.background)) + '"></div>'
          + '<div class="story-builder__pagethumb-num">' + (i + 1) + '</div>'
          + '<button type="button" class="admin-btn admin-btn--icon admin-btn--ghost story-builder__pagethumb-del" data-act="story-build-delete-page" data-page-id="' + E(p.id) + '" aria-label="Delete page">' + ic("trash-2") + '</button>'
          + '</div>';
      }).join("")
    + '</div>'
    + '<div class="row" style="gap:8px;margin-top:10px">'
    + '<button type="button" class="admin-btn admin-btn--ghost" data-act="story-build-add-page">' + ic("plus") + ' Blank page</button>'
    + '<button type="button" class="admin-btn admin-btn--ghost" data-act="story-build-duplicate-page">' + ic("copy") + ' Duplicate</button>'
    + '</div></div>';
}
```

(`storyBuilderCanvas`/`storyBuilderLayersPanel` are stubbed for this task and filled in by Tasks 4-6 — add temporary one-liners now so the file stays valid:)

```js
function storyBuilderCanvas(page){
  return '<div class="story-builder__canvas admin-card"><p class="tiny mute">Canvas - Task 4</p></div>';
}
function storyBuilderLayersPanel(page){
  return '<div class="story-builder__layers admin-card"><p class="tiny mute">Layers panel - Task 6</p></div>';
}
```

- [ ] **Step 2: Add the filmstrip/three-column layout CSS**

Add near the other admin-scope layout rules (any existing `.admin-*` block is a fine neighbor - e.g. right after the Launch Readiness CSS block):

```css
.story-builder{ display:grid; grid-template-columns:180px 1fr 260px; gap:16px; align-items:start; }
@media (max-width:960px){ .story-builder{ grid-template-columns:1fr; } }
.story-builder__filmstrip{ padding:12px; }
.story-builder__pagelist{ display:flex; flex-direction:column; gap:8px; max-height:70vh; overflow-y:auto; }
.story-builder__pagethumb{ position:relative; border:2px solid var(--admin-border); border-radius:8px; aspect-ratio:1/1.44; cursor:grab; overflow:hidden; }
.story-builder__pagethumb.is-selected{ border-color:var(--admin-accent); box-shadow:0 0 0 2px var(--admin-accent-soft, rgba(0,0,0,.08)); }
.story-builder__pagethumb-preview{ position:absolute; inset:0; }
.story-builder__pagethumb-num{ position:absolute; bottom:4px; left:4px; background:rgba(0,0,0,.55); color:#fff; font-size:10px; padding:1px 5px; border-radius:3px; }
.story-builder__pagethumb-del{ position:absolute; top:2px; right:2px; }
```

- [ ] **Step 3: Wire page-list ACTIONS: select, add, duplicate, delete**

Add to `ACTIONS`:

```js
  "story-build-select-page": (el) => {
    AppState.admin.storyBuilder.selectedPageId = el.getAttribute("data-page-id");
    AppState.admin.storyBuilder.selectedLayerId = "";
    rerender();
  },
  "story-build-add-page": () => {
    const sb = AppState.admin.storyBuilder;
    const p = blankBookPage();
    sb.pages.push(p);
    sb.selectedPageId = p.id;
    sb.dirty = true;
    rerender();
  },
  "story-build-duplicate-page": () => {
    const sb = AppState.admin.storyBuilder;
    const current = sb.pages.find(p => p.id === sb.selectedPageId);
    if (!current) return;
    const copy = JSON.parse(JSON.stringify(current));
    copy.id = uid("pg");
    copy.layers.forEach(ly => { ly.id = uid("ly"); });
    const idx = sb.pages.findIndex(p => p.id === current.id);
    sb.pages.splice(idx + 1, 0, copy);
    sb.selectedPageId = copy.id;
    sb.dirty = true;
    rerender();
  },
  "story-build-delete-page": (el, ev) => {
    ev.stopPropagation();
    const sb = AppState.admin.storyBuilder;
    const pid = el.getAttribute("data-page-id");
    if (sb.pages.length <= 1){ toast("A book needs at least one page.", "bad"); return; }
    confirmDelete("this page", () => {
      sb.pages = sb.pages.filter(p => p.id !== pid);
      if (sb.selectedPageId === pid) sb.selectedPageId = sb.pages[0].id;
      sb.dirty = true;
      rerender();
    });
  },
  "story-build-close": (el) => {
    const id = el.getAttribute("data-id");
    if (AppState.admin.storyBuilder.dirty && !confirm("You have unsaved changes. Leave without saving?")) return;
    AppState.admin.storyBuilder.storyId = null;
    navigate("#/admin/stories");
  },
```

- [ ] **Step 4: Wire page reordering via native HTML5 drag-and-drop**

This codebase has no prior drag-and-drop pattern, so this introduces the plain HTML5 DnD API (no library) directly on the filmstrip. Add a mount function and call it from `render()`:

```js
function mountStoryBuilderDrag(){
  const list = $(".story-builder__pagelist");
  if (!list) return;
  let dragId = null;
  list.querySelectorAll(".story-builder__pagethumb").forEach(el => {
    el.addEventListener("dragstart", () => { dragId = el.getAttribute("data-page-id"); el.classList.add("is-dragging"); });
    el.addEventListener("dragend", () => { el.classList.remove("is-dragging"); });
    el.addEventListener("dragover", (e) => e.preventDefault());
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      const overId = el.getAttribute("data-page-id");
      if (!dragId || dragId === overId) return;
      const sb = AppState.admin.storyBuilder;
      const from = sb.pages.findIndex(p => p.id === dragId);
      const to = sb.pages.findIndex(p => p.id === overId);
      if (from < 0 || to < 0) return;
      const [moved] = sb.pages.splice(from, 1);
      sb.pages.splice(to, 0, moved);
      sb.dirty = true;
      rerender();
    });
  });
}
```

In `render()` (`index.html:15251`, right after the existing `drawIcons();` line), add:

```js
  mountStoryBuilderDrag();
```

(The function itself no-ops via the `if (!list) return;` guard on every route that isn't the builder, so it's safe to call unconditionally on every render, matching how `Parallax.mount()` right below it already works the same way.)

- [ ] **Step 5: `node --check`, then manual browser verification**

```bash
node --check index.html
```

In the browser: open a story's builder, confirm one blank page shows in the filmstrip; add a page, confirm it appears and becomes selected; duplicate a page, confirm a copy appears right after it; drag pages to reorder, confirm the order updates; delete a page, confirm it's removed and selection falls back sensibly; try deleting the last remaining page and confirm the "needs at least one page" toast appears and nothing is removed; click Close with unsaved changes and confirm the browser's confirm() dialog appears.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Add the book builder shell and page filmstrip (add/duplicate/delete/reorder)"
```

---

## Task 4: Canvas — background picker + read-only layer rendering

**Files:**
- Modify: `index.html` — implement `storyBuilderCanvas`, add `layerToBuilderHTML`, background-picker markup/CSS, and their ACTIONS

- [ ] **Step 1: Add a shared layer-to-HTML renderer for the canvas**

This is a *builder-side* renderer (shows layers as selectable/draggable boxes). `books/reader.html` gets its own equivalent in Task 9 — per this project's established convention of small helpers being duplicated per-file rather than shared through a build step (the same reasoning already documented for `notify`/`send-newsletter`'s duplicated `json()`/`CORS_HEADERS` helpers), not an oversight.

Add near `bgToCSS` (Task 1):

```js
const TEXT_STYLE_CSS = {
  heading: "font-family:'Poppins',sans-serif;font-weight:700;font-size:clamp(20px,4.5vw,2.2em);line-height:1.18",
  body:    "font-weight:600;font-size:clamp(13px,2.2vw,1.3em);line-height:1.5",
  quote:   "font-weight:600;font-style:italic;font-size:clamp(13px,2.2vw,1.3em);line-height:1.5",
  tag:     "display:inline-block;font-weight:700;font-size:0.72em;letter-spacing:.08em;text-transform:uppercase;color:#7A1F19;background:rgba(255,255,255,.6);padding:6px 14px;border-radius:999px"
};
const IMAGE_PLACEMENT_CSS = {
  "full-bg":      "left:0;top:0;width:100%;height:100%;object-fit:cover",
  "top-half":     "left:0;top:0;width:100%;height:50%;object-fit:cover",
  "bottom-half":  "left:0;top:50%;width:100%;height:50%;object-fit:cover",
  "inset-left":   "left:4%;top:30%;width:44%;height:40%;object-fit:contain",
  "inset-right":  "left:52%;top:30%;width:44%;height:40%;object-fit:contain",
  "inset-center": "left:20%;top:30%;width:60%;height:40%;object-fit:contain"
};

function layerToBuilderHTML(layer, selected){
  const sel = selected ? " is-selected" : "";
  const lockedCls = layer.locked ? " is-locked" : "";
  if (layer.type === "text"){
    return '<div class="story-builder__layer story-builder__layer--text' + sel + lockedCls + '"'
      + ' data-act="story-build-select-layer" data-layer-id="' + E(layer.id) + '"'
      + ' style="left:' + layer.x + '%;top:' + layer.y + '%;width:' + layer.w + '%;height:' + layer.h + '%;'
      + 'text-align:' + E(layer.align) + ';color:' + E(layer.color || "inherit") + ';' + TEXT_STYLE_CSS[layer.style] + '">'
      + E(layer.content) + '</div>';
  }
  return '<img class="story-builder__layer story-builder__layer--image' + sel + lockedCls + '"'
    + ' data-act="story-build-select-layer" data-layer-id="' + E(layer.id) + '"'
    + ' src="' + E(layer.src) + '" alt="' + E(layer.alt) + '"'
    + ' style="position:absolute;' + (IMAGE_PLACEMENT_CSS[layer.placement] || IMAGE_PLACEMENT_CSS["inset-center"]) + '">';
}
```

- [ ] **Step 2: Implement the real canvas**

Replace the Task 3 stub:

```js
function storyBuilderCanvas(page){
  return '<div class="story-builder__canvas-wrap admin-card">'
    + '<div class="row" style="gap:10px;margin-bottom:12px;flex-wrap:wrap">'
    + '<select class="admin-select" data-act="story-build-bg-type" style="width:auto">'
    + ["color","gradient","image","gif"].map(t => '<option value="' + t + '"' + (page.background.type === t ? " selected" : "") + '>' + titleCase(t) + '</option>').join("")
    + '</select>'
    + (page.background.type === "color" || page.background.type === "gradient"
        ? '<input class="admin-input" type="text" style="width:220px" placeholder="'
          + (page.background.type === "color" ? "#RRGGBB" : "#c1,#c2,angle") + '"'
          + ' value="' + E(page.background.value) + '" data-act="story-build-bg-value">'
        : '<button type="button" class="admin-btn admin-btn--ghost" data-act="story-build-bg-pick">' + ic("upload") + ' Choose image/GIF</button>'
          + (page.background.value ? '<span class="tiny mute">' + E(page.background.value.split("/").pop()) + '</span>' : ""))
    + '</div>'
    + '<div class="story-builder__canvas" id="story-canvas" style="' + E(bgToCSS(page.background)) + '">'
    + page.layers.map(ly => layerToBuilderHTML(ly, ly.id === AppState.admin.storyBuilder.selectedLayerId)).join("")
    + '</div>'
    + '<button type="button" class="admin-btn admin-btn--ghost" style="margin-top:10px" data-act="story-build-add-text">' + ic("plus") + ' Add text</button>'
    + '<button type="button" class="admin-btn admin-btn--ghost" style="margin-top:10px" data-act="story-build-add-image">' + ic("image") + ' Add image</button>'
    + '</div>';
}
```

- [ ] **Step 3: Add canvas CSS (fixed aspect ratio, matching the reader's own `1/1.44`)**

```css
.story-builder__canvas-wrap{ padding:16px; }
.story-builder__canvas{ position:relative; width:min(420px,100%); aspect-ratio:1/1.44; margin:0 auto; border-radius:8px; overflow:hidden; border:1px solid var(--admin-border); }
.story-builder__layer{ position:absolute; cursor:move; box-sizing:border-box; }
.story-builder__layer.is-selected{ outline:2px solid var(--admin-accent); outline-offset:2px; }
.story-builder__layer.is-locked{ cursor:not-allowed; }
.story-builder__layer.is-locked.is-selected{ outline-color:#999; }
```

- [ ] **Step 4: Wire background-picker ACTIONS**

```js
  "story-build-bg-type": (el) => {
    const page = currentBuilderPage();
    if (!page) return;
    page.background = { type: el.value, value: el.value === "color" ? "#FDECEA" : el.value === "gradient" ? "#8C2620,#5E1712,160" : "" };
    AppState.admin.storyBuilder.dirty = true;
    rerender();
  },
  "story-build-bg-value": (el) => {
    const page = currentBuilderPage();
    if (!page) return;
    page.background.value = el.value;
    AppState.admin.storyBuilder.dirty = true;
    const canvas = $("#story-canvas");
    if (canvas) canvas.style.cssText += ";" + bgToCSS(page.background);
  },
  "story-build-bg-pick": () => {
    const page = currentBuilderPage();
    if (!page) return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*,.gif";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const url = await uploadToStorage(file, "story-pages");
        page.background = { type: file.type === "image/gif" ? "gif" : "image", value: url };
        AppState.admin.storyBuilder.dirty = true;
        rerender();
      } catch(err){ toast("Upload failed: " + err.message, "bad"); }
    };
    input.click();
  },
```

Add the shared lookup helper near `blankBookPage`:

```js
function currentBuilderPage(){
  const sb = AppState.admin.storyBuilder;
  return sb.pages && sb.pages.find(p => p.id === sb.selectedPageId);
}
```

- [ ] **Step 5: Wire layer selection (read-only for now — drag/resize/edit come in Task 5)**

```js
  "story-build-select-layer": (el, ev) => {
    ev.stopPropagation();
    AppState.admin.storyBuilder.selectedLayerId = el.getAttribute("data-layer-id");
    rerender();
  },
```

- [ ] **Step 6: `node --check`, then manual browser verification**

```bash
node --check index.html
```

In the browser: change a page's background type between color/gradient/image, confirm the canvas preview updates live; upload a background image, confirm it renders as a cover-fit background; confirm the filmstrip thumbnail for that page also reflects the new background (it reuses `bgToCSS` already).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "Add the book builder canvas with background picker and layer rendering"
```

---

## Task 5: Freeform text layers — add, drag, resize, inline edit

**Files:**
- Modify: `index.html` — add drag/resize pointer-event wiring, text-add/edit ACTIONS

- [ ] **Step 1: Wire "Add text"**

```js
  "story-build-add-text": () => {
    const page = currentBuilderPage();
    if (!page) return;
    const ly = blankTextLayer();
    page.layers.push(ly);
    AppState.admin.storyBuilder.selectedLayerId = ly.id;
    AppState.admin.storyBuilder.dirty = true;
    rerender();
  },
  "story-build-add-image": () => {
    const page = currentBuilderPage();
    if (!page) return;
    openMediaPicker((m) => {
      const ly = blankImageLayer(m.path, m.alt);
      page.layers.push(ly);
      AppState.admin.storyBuilder.selectedLayerId = ly.id;
      AppState.admin.storyBuilder.dirty = true;
      rerender();
    });
  },
```

- [ ] **Step 2: Add pointer-driven drag/resize, mounted alongside the page-reorder mount function**

This project has no prior freeform-drag precedent (Task 3 introduced page-reorder via native HTML5 DnD; this is a different interaction - continuous pixel tracking - so it uses raw Pointer Events instead, the same low-level primitive `left_click_drag` in browser-automation tooling already targets). Add:

```js
function mountStoryBuilderCanvasDrag(){
  const canvas = $("#story-canvas");
  if (!canvas) return;
  const sb = AppState.admin.storyBuilder;
  const page = currentBuilderPage();
  if (!page) return;

  canvas.querySelectorAll(".story-builder__layer--text").forEach(el => {
    const layerId = el.getAttribute("data-layer-id");
    const layer = page.layers.find(l => l.id === layerId);
    if (!layer || layer.locked) return;

    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const next = prompt("Edit text:", layer.content);
      if (next === null) return;
      layer.content = next;
      sb.dirty = true;
      rerender();
    });

    el.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("story-builder__resize-handle")) return;
      e.preventDefault();
      sb.selectedLayerId = layerId;
      const rect = canvas.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const startLX = layer.x, startLY = layer.y;
      const onMove = (mv) => {
        const dxPct = (mv.clientX - startX) / rect.width * 100;
        const dyPct = (mv.clientY - startY) / rect.height * 100;
        layer.x = Math.max(0, Math.min(100 - layer.w, startLX + dxPct));
        layer.y = Math.max(0, Math.min(100 - layer.h, startLY + dyPct));
        el.style.left = layer.x + "%";
        el.style.top = layer.y + "%";
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        sb.dirty = true;
        rerender();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });

    const handle = document.createElement("div");
    handle.className = "story-builder__resize-handle";
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const startW = layer.w, startH = layer.h;
      const onMove = (mv) => {
        const dwPct = (mv.clientX - startX) / rect.width * 100;
        const dhPct = (mv.clientY - startY) / rect.height * 100;
        layer.w = Math.max(5, Math.min(100 - layer.x, startW + dwPct));
        layer.h = Math.max(5, Math.min(100 - layer.y, startH + dhPct));
        el.style.width = layer.w + "%";
        el.style.height = layer.h + "%";
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        sb.dirty = true;
        rerender();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    el.appendChild(handle);
  });
}
```

Add its CSS:

```css
.story-builder__resize-handle{ position:absolute; right:-6px; bottom:-6px; width:14px; height:14px; background:var(--admin-accent); border:2px solid #fff; border-radius:50%; cursor:nwse-resize; }
.story-builder__layer:not(.is-selected) .story-builder__resize-handle{ display:none; }
```

In `render()`, right after the `mountStoryBuilderDrag();` line added in Task 3, add:

```js
  mountStoryBuilderCanvasDrag();
```

- [ ] **Step 3: `node --check`, then manual browser verification**

```bash
node --check index.html
```

In the browser: add a text layer, confirm it appears centered-ish on the canvas; drag it, confirm it moves and stays within the page bounds (can't be dragged fully off-canvas); select it and drag its resize handle, confirm width/height change and stay within bounds; double-click it, type new text in the prompt, confirm it updates on the canvas.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add freeform drag/resize/inline-edit for text layers"
```

---

## Task 6: Layers panel — z-order, lock, style/placement controls

**Files:**
- Modify: `index.html` — implement `storyBuilderLayersPanel`, its ACTIONS, and layer-reorder drag

- [ ] **Step 1: Implement the real layers panel**

Replace the Task 3 stub:

```js
function storyBuilderLayersPanel(page){
  if (!page.layers.length){
    return '<div class="story-builder__layers admin-card"><p class="admin-hint">Layers</p>'
      + '<p class="tiny mute">No layers yet - add text or an image on the canvas.</p></div>';
  }
  const sel = AppState.admin.storyBuilder.selectedLayerId;
  /* Top of the list = front-most, i.e. reverse array order (array order is
     bottom-to-top z-order, per the data model in Task 1). */
  const rows = page.layers.slice().reverse().map(ly => {
    const isSel = ly.id === sel;
    return '<div class="story-builder__layerrow' + (isSel ? " is-selected" : "") + '" draggable="true"'
      + ' data-act="story-build-select-layer" data-layer-id="' + E(ly.id) + '">'
      + '<button type="button" class="admin-btn admin-btn--icon admin-btn--ghost" data-act="story-build-toggle-lock" data-layer-id="' + E(ly.id) + '" aria-label="' + (ly.locked ? "Unlock" : "Lock") + '">'
      + ic(ly.locked ? "lock" : "lock-open") + '</button>'
      + '<span class="tiny" style="flex:1">' + (ly.type === "text" ? E(ly.content).slice(0, 24) : "Image") + '</span>'
      + (ly.type === "text"
          ? '<select class="admin-select" style="width:auto" data-act="story-build-set-style" data-layer-id="' + E(ly.id) + '">'
            + ["heading","body","quote","tag"].map(s => '<option value="' + s + '"' + (ly.style === s ? " selected" : "") + '>' + titleCase(s) + '</option>').join("")
            + '</select>'
          : '<select class="admin-select" style="width:auto" data-act="story-build-set-placement" data-layer-id="' + E(ly.id) + '">'
            + ["full-bg","top-half","bottom-half","inset-left","inset-right","inset-center"].map(pl => '<option value="' + pl + '"' + (ly.placement === pl ? " selected" : "") + '>' + titleCase(pl.replace("-"," ")) + '</option>').join("")
            + '</select>')
      + '<button type="button" class="admin-btn admin-btn--icon admin-btn--ghost" data-act="story-build-delete-layer" data-layer-id="' + E(ly.id) + '" aria-label="Delete layer">' + ic("trash-2") + '</button>'
      + '</div>';
  }).join("");
  return '<div class="story-builder__layers admin-card"><p class="admin-hint">Layers</p>' + rows + '</div>';
}
```

- [ ] **Step 2: Add layers-panel CSS**

```css
.story-builder__layerrow{ display:flex; align-items:center; gap:6px; padding:6px; border:1px solid var(--admin-border); border-radius:6px; margin-bottom:6px; cursor:grab; }
.story-builder__layerrow.is-selected{ border-color:var(--admin-accent); }
```

- [ ] **Step 3: Wire lock/style/placement/delete ACTIONS**

```js
  "story-build-toggle-lock": (el, ev) => {
    ev.stopPropagation();
    const page = currentBuilderPage();
    const ly = page && page.layers.find(l => l.id === el.getAttribute("data-layer-id"));
    if (!ly) return;
    ly.locked = !ly.locked;
    AppState.admin.storyBuilder.dirty = true;
    rerender();
  },
  "story-build-set-style": (el, ev) => {
    ev.stopPropagation();
    const page = currentBuilderPage();
    const ly = page && page.layers.find(l => l.id === el.getAttribute("data-layer-id"));
    if (!ly) return;
    ly.style = el.value;
    AppState.admin.storyBuilder.dirty = true;
    rerender();
  },
  "story-build-set-placement": (el, ev) => {
    ev.stopPropagation();
    const page = currentBuilderPage();
    const ly = page && page.layers.find(l => l.id === el.getAttribute("data-layer-id"));
    if (!ly) return;
    ly.placement = el.value;
    AppState.admin.storyBuilder.dirty = true;
    rerender();
  },
  "story-build-delete-layer": (el, ev) => {
    ev.stopPropagation();
    const page = currentBuilderPage();
    if (!page) return;
    const lid = el.getAttribute("data-layer-id");
    confirmDelete("this layer", () => {
      page.layers = page.layers.filter(l => l.id !== lid);
      if (AppState.admin.storyBuilder.selectedLayerId === lid) AppState.admin.storyBuilder.selectedLayerId = "";
      AppState.admin.storyBuilder.dirty = true;
      rerender();
    });
  },
```

- [ ] **Step 4: Wire layer-row reordering (z-order) via the same native-DnD pattern as page reordering**

Add to `mountStoryBuilderDrag()` (Task 3), right after the existing filmstrip-drag wiring, inside the same function body:

```js
  const layerList = $(".story-builder__layers");
  if (layerList){
    let dragLayerId = null;
    layerList.querySelectorAll(".story-builder__layerrow").forEach(el => {
      el.addEventListener("dragstart", () => { dragLayerId = el.getAttribute("data-layer-id"); });
      el.addEventListener("dragover", (e) => e.preventDefault());
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        const overId = el.getAttribute("data-layer-id");
        if (!dragLayerId || dragLayerId === overId) return;
        const page = currentBuilderPage();
        if (!page) return;
        const from = page.layers.findIndex(l => l.id === dragLayerId);
        const to = page.layers.findIndex(l => l.id === overId);
        if (from < 0 || to < 0) return;
        const [moved] = page.layers.splice(from, 1);
        page.layers.splice(to, 0, moved);
        AppState.admin.storyBuilder.dirty = true;
        rerender();
      });
    });
  }
```

(Note: the layers panel lists front-most first, i.e. reversed from `page.layers` array order - dropping row A onto row B's position in the visual list should still resolve to the correct underlying array indices via `findIndex`, which works directly against `page.layers`'s real order regardless of how it's displayed, so no extra reversal math is needed here.)

- [ ] **Step 5: `node --check`, then manual browser verification**

```bash
node --check index.html
```

In the browser: add two text layers, confirm both show in the layers panel with the front-most (most recently added) on top; drag to reorder them, confirm the canvas stacking order changes to match; lock a layer, confirm it can no longer be dragged/resized on the canvas (verify by attempting to drag it); change a text layer's style dropdown between Heading/Body/Quote/Tag-label, confirm the canvas text visibly restyles; add an image layer, confirm its placement dropdown appears in the panel instead of a style dropdown, and changing it moves/resizes the image on the canvas; delete a layer via the panel's trash icon, confirm the confirm-delete flow runs and it's removed.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Add the layers panel: lock/unlock, z-order, style and placement controls"
```

---

## Task 7: Save wiring

**Files:**
- Modify: `index.html` — implement `story-build-save`, unload guard

- [ ] **Step 1: Wire Save**

```js
  "story-build-save": async (el) => {
    const id = el.getAttribute("data-id");
    const sb = AppState.admin.storyBuilder;
    el.disabled = true;
    try {
      await db.update("stories", id, { pages: sb.pages });
      sb.dirty = false;
      toast("Pages saved.");
      rerender();
    } finally {
      el.disabled = false;
    }
  },
```

(`db.update()` already shows its own `toast("Could not save: " + error.message, "bad")` and throws on failure per `index.html:3227`, so no duplicate error handling is needed here beyond letting that propagate and re-enabling the button in `finally`.)

- [ ] **Step 2: Warn on browser tab close/navigate-away with unsaved changes**

Add near the other top-level `window.addEventListener` calls:

```js
window.addEventListener("beforeunload", (e) => {
  if (AppState.admin.storyBuilder.dirty){
    e.preventDefault();
    e.returnValue = "";
  }
});
```

- [ ] **Step 3: `node --check`, then manual browser verification**

```bash
node --check index.html
```

In the browser: make a change (add a page, move some text), click Save, confirm the "Unsaved" badge disappears and a success toast shows; reload the admin builder page for that same story, confirm every change persisted exactly (pages, layers, positions, styles, locks); try closing the browser tab with unsaved changes present and confirm the browser's native "leave site?" prompt appears.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Wire Save for the book builder, with an unsaved-changes exit guard"
```

---

## Task 8: The generic data-driven reader (`books/reader.html`)

**Files:**
- Create: `books/reader.html`
- Reference (read-only, for copying the unchanged flip engine): `books/story-fold-that-would-not.html`

- [ ] **Step 1: Create the file's head, copying the unchanged CSS verbatim**

Create `books/reader.html`. Copy `<!DOCTYPE html>` through the closing `</style>` from `books/story-fold-that-would-not.html:1-423` **verbatim, with one exception**: change the `<title>` tag (line 6) from the hardcoded `Zech&#39;s Paper Airplane Parade` to a placeholder the script fills in after fetching the story (`<title>Loading story...</title>`), and change `--teal-color: #BC3229;` (a leftover unused variable, line 19) to remain as-is (harmless, not worth touching in this copy). Every other line of CSS (the `.book`/`.paper`/`.front`/`.back`/`.page-content`/`.thumbnail-grid`/`.modal-overlay`/single-page-mobile-mode rules) is copied exactly as-is — none of it references book-specific content, only structure that the new data-driven markup will also produce.

- [ ] **Step 2: Add the body skeleton (structure only — pages are injected by JS)**

After the copied `</style></head>`, add:

```html
<body>
    <div class="app-container">
        <div class="book-container" id="book-container">
            <div class="book-wrapper">
                <div class="book" id="book-pages"></div>
            </div>
        </div>
        <div class="bottom-controls">
            <button id="all-pages-btn"><p style="font-family: poppins; font-size: 12px; color: white; letter-spacing: 2px; margin:0"><b>&#9776;  ALL PAGES</b></p></button>
        </div>
        <div id="thumbnail-modal" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-content">
                <div class="modal-header">
                   <p id="thumbnail-title" style="font-family: poppins; font-size: 22px; color: #BC3229; letter-spacing: 0px; margin:0"><b></b></p>
                    <button class="close-modal-btn" aria-label="Close" title="Close">&times;</button>
                </div>
                <div id="thumbnail-grid" class="thumbnail-grid"></div>
            </div>
        </div>
    </div>
    <div id="reader-error" style="display:none;position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f0f0f0;font-family:sans-serif;color:#555;padding:24px;text-align:center"></div>
</body>
</html>
```

- [ ] **Step 3: Add the data layer and page renderer**

Before the closing `</body>`, add a `<script>` block. This duplicates `bgToCSS`/`TEXT_STYLE_CSS`/`IMAGE_PLACEMENT_CSS` from `index.html` (Tasks 1 and 4) rather than sharing them, per this project's established no-build-step, duplicate-small-helpers convention:

```html
<script>
(function(){
  const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkY3RrZmh3eWd3d3VsaXB3bnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTUzNjUsImV4cCI6MjEwMzU5MTM2NX0.5KraVohURHNDx-n0mb6o3egJPf1KkpecBSz8fMRlQcI";

  function esc(s){
    return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function bgToCSS(bg){
    if (!bg) return "background-color:#FFF6E2";
    if (bg.type === "color") return "background-color:" + (bg.value || "#FFF6E2");
    if (bg.type === "gradient"){
      const parts = String(bg.value || "").split(",");
      const c1 = parts[0] || "#8C2620", c2 = parts[1] || "#5E1712", angle = parts[2] || "160";
      return "background-image:linear-gradient(" + angle + "deg, " + c1 + " 0%, " + c2 + " 100%)";
    }
    if (bg.type === "image" || bg.type === "gif") return "background-image:url('" + String(bg.value || "").replace(/'/g,"%27") + "');background-size:cover;background-position:center";
    return "background-color:#FFF6E2";
  }

  const TEXT_STYLE_CSS = {
    heading: "font-family:'Poppins',sans-serif;font-weight:700;font-size:clamp(20px,4.5vw,2.2em);line-height:1.18",
    body:    "font-weight:600;font-size:clamp(13px,2.2vw,1.3em);line-height:1.5",
    quote:   "font-weight:600;font-style:italic;font-size:clamp(13px,2.2vw,1.3em);line-height:1.5",
    tag:     "display:inline-block;font-weight:700;font-size:0.72em;letter-spacing:.08em;text-transform:uppercase;color:#7A1F19;background:rgba(255,255,255,.6);padding:6px 14px;border-radius:999px"
  };
  const IMAGE_PLACEMENT_CSS = {
    "full-bg":      "left:0;top:0;width:100%;height:100%;object-fit:cover",
    "top-half":     "left:0;top:0;width:100%;height:50%;object-fit:cover",
    "bottom-half":  "left:0;top:50%;width:100%;height:50%;object-fit:cover",
    "inset-left":   "left:4%;top:30%;width:44%;height:40%;object-fit:contain",
    "inset-right":  "left:52%;top:30%;width:44%;height:40%;object-fit:contain",
    "inset-center": "left:20%;top:30%;width:60%;height:40%;object-fit:contain"
  };

  function layerToReaderHTML(layer){
    if (layer.type === "text"){
      return '<div style="position:absolute;left:' + layer.x + '%;top:' + layer.y + '%;width:' + layer.w + '%;height:' + layer.h + '%;'
        + 'text-align:' + esc(layer.align) + ';color:' + esc(layer.color || "inherit") + ';' + TEXT_STYLE_CSS[layer.style] + '">'
        + esc(layer.content) + '</div>';
    }
    return '<img src="' + esc(layer.src) + '" alt="' + esc(layer.alt) + '"'
      + ' style="position:absolute;' + (IMAGE_PLACEMENT_CSS[layer.placement] || IMAGE_PLACEMENT_CSS["inset-center"]) + '">';
  }

  function pageContentHTML(page, faceId, pageNum){
    return '<div class="page-content" id="' + faceId + '" style="' + bgToCSS(page.background) + '">'
      + page.layers.map(layerToReaderHTML).join("")
      + '<div class="page-number">' + pageNum + '</div></div>';
  }

  /* Builds the .paper sheets from a flat pages[] array. Physical papers are
     pairs of faces (front=odd page, back=even page); an odd total page
     count gets a final paper whose back face is genuinely absent from the
     DOM, not a hidden dummy page - the fix for the old static files' "Hidden
     Page" workaround (see the design spec for why that existed). */
  function buildPapers(pages){
    const papers = [];
    for (let i = 0; i < pages.length; i += 2){
      const frontPage = pages[i];
      const backPage = pages[i + 1];
      const paperNum = papers.length + 1;
      const frontFace = 'f' + paperNum, backFace = backPage ? ('b' + paperNum) : null;
      let html = '<div class="paper" id="p' + paperNum + '">'
        + '<div class="front">' + pageContentHTML(frontPage, frontFace, i + 1) + '</div>';
      if (backPage) html += '<div class="back">' + pageContentHTML(backPage, backFace, i + 2) + '</div>';
      html += '</div>';
      papers.push(html);
    }
    return papers.join("");
  }

  window.CCS_READER = { esc, bgToCSS, layerToReaderHTML, pageContentHTML, buildPapers };
})();
</script>
```

- [ ] **Step 4: Add the fetch + init logic, and the flip-engine JS adapted for a dynamic page count**

Add a second `<script>` block right after the one from Step 3. This is `books/story-fold-that-would-not.html:474-649`'s existing flip/thumbnail/mobile-mode JS, with exactly three changes: (1) `numOfPapers`/`totalPages`/`flatFaces`/`modalMaxPages` are computed from the fetched data instead of hardcoded, (2) page building happens after a successful fetch, and (3) a fetch failure shows `#reader-error` instead of an unstyled blank page:

```html
<script>
document.addEventListener('DOMContentLoaded', async function () {
  const params = new URLSearchParams(location.search);
  const storyId = params.get('story');
  // Declared again here (not shared from the Step 3 script block) because
  // that block wraps its own copy in an IIFE, and this project has no
  // module system to import across <script> tags with - two tiny string
  // constants are cheaper than restructuring either block's scope.
  const SUPABASE_URL = "https://wdctkfhwygwwulipwnys.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkY3RrZmh3eWd3d3VsaXB3bnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTUzNjUsImV4cCI6MjEwMzU5MTM2NX0.5KraVohURHNDx-n0mb6o3egJPf1KkpecBSz8fMRlQcI";

  const errorBox = document.getElementById('reader-error');
  const bookPagesEl = document.getElementById('book-pages');

  if (!storyId){
    errorBox.textContent = "No story specified.";
    errorBox.style.display = 'flex';
    return;
  }

  let story;
  try {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/stories?select=data&id=eq.' + encodeURIComponent(storyId),
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!rows.length) throw new Error('Story not found');
    story = rows[0].data;
  } catch(err){
    errorBox.textContent = "This story couldn't be loaded (" + err.message + ").";
    errorBox.style.display = 'flex';
    return;
  }

  const pages = (story.pages && story.pages.length) ? story.pages : [];
  if (!pages.length){
    errorBox.textContent = "This story has no pages yet.";
    errorBox.style.display = 'flex';
    return;
  }

  document.title = story.title || "Story";
  document.getElementById('thumbnail-title').innerHTML = '<b>' + window.CCS_READER.esc(story.title || "Story") + '</b>';
  bookPagesEl.innerHTML = window.CCS_READER.buildPapers(pages);

  const papers = document.querySelectorAll('.paper');
  const allPagesBtn = document.getElementById('all-pages-btn');
  const thumbnailModal = document.getElementById('thumbnail-modal');
  const closeModalBtn = document.querySelector('.close-modal-btn');
  const thumbnailGrid = document.getElementById('thumbnail-grid');
  const bookContainer = document.getElementById('book-container');

  let currentLocation = 0;
  const numOfPapers = papers.length;
  const totalPages = pages.length;
  const modalMaxPages = totalPages;

  const mobileMQ = window.matchMedia('(max-width: 768px)');
  const isMobileBook = () => mobileMQ.matches;
  const flatFaceIds = [];
  for (let i = 0; i < totalPages; i += 2){
    const paperNum = Math.floor(i / 2) + 1;
    flatFaceIds.push('f' + paperNum);
    if (i + 1 < totalPages) flatFaceIds.push('b' + paperNum);
  }
  const flatFaces = flatFaceIds.map(id => { const el = document.getElementById(id); return el && el.closest('.front, .back'); }).filter(Boolean);
  let mobileIndex = 0;

  function notifyPagePosition() {
    const atLastPage = isMobileBook() ? mobileIndex === flatFaces.length - 1 : currentLocation >= numOfPapers;
    try { window.parent.postMessage({ source: 'ccs-book', atLastPage: atLastPage }, '*'); }
    catch (_e) { /* no parent frame - reading the file on its own */ }
  }

  function showMobilePage(i) {
    mobileIndex = Math.max(0, Math.min(flatFaces.length - 1, i));
    flatFaces.forEach((el, idx) => el.classList.toggle('mobile-active', idx === mobileIndex));
    notifyPagePosition();
  }
  function mobileNext() { if (mobileIndex < flatFaces.length - 1) showMobilePage(mobileIndex + 1); }
  function mobilePrev() { if (mobileIndex > 0) showMobilePage(mobileIndex - 1); }

  allPagesBtn.addEventListener('click', openThumbnailView);
  closeModalBtn.addEventListener('click', closeThumbnailView);
  thumbnailModal.addEventListener('click', function(e) { if (e.target === thumbnailModal) closeThumbnailView(); });

  papers.forEach(paper => {
    const front = paper.querySelector('.front');
    const back = paper.querySelector('.back');
    if (front) front.addEventListener('click', (e) => { e.stopPropagation(); if (isMobileBook()) mobileNext(); else goNextPage(); });
    if (back) back.addEventListener('click', (e) => { e.stopPropagation(); if (isMobileBook()) mobilePrev(); else goPrevPage(); });
  });

  document.addEventListener('keydown', function(e) {
    if (thumbnailModal.classList.contains('show')) { if (e.key === 'Escape') closeThumbnailView(); return; }
    if (e.key === 'ArrowLeft') { if (isMobileBook()) mobilePrev(); else goPrevPage(); }
    if (e.key === 'ArrowRight') { if (isMobileBook()) mobileNext(); else goNextPage(); }
    if (e.key === 'Enter' || e.key === ' ') { if (document.activeElement === allPagesBtn) { e.preventDefault(); openThumbnailView(); } }
  });

  let turning = null;

  function restack() {
    bookContainer.classList.toggle('opened', currentLocation > 0);
    papers.forEach((paper, index) => {
      const paperNum = index + 1;
      if (paperNum <= currentLocation) { paper.classList.add('flipped'); paper.style.zIndex = paperNum; }
      else { paper.classList.remove('flipped'); paper.style.zIndex = numOfPapers - index; }
    });
    notifyPagePosition();
  }

  function updateBookState() { restack(); }

  function turnPage(paper, move) {
    if (turning) return false;
    turning = paper;
    paper.classList.add('turning');
    move();
    restack();
    const settle = (e) => {
      if (e && e.target !== paper) return;
      paper.removeEventListener('transitionend', settle);
      clearTimeout(guard);
      paper.classList.remove('turning');
      turning = null;
      restack();
    };
    paper.addEventListener('transitionend', settle);
    const guard = setTimeout(settle, 1100);
    return true;
  }

  function goNextPage() {
    if (currentLocation >= numOfPapers) return;
    const sheet = papers[currentLocation];
    if (!sheet) return;
    turnPage(sheet, () => { currentLocation++; });
  }

  function goPrevPage() {
    if (currentLocation <= 0) return;
    const sheet = papers[currentLocation - 1];
    if (!sheet) return;
    turnPage(sheet, () => { currentLocation--; });
  }

  function goToPage(pageNum) {
    if (isMobileBook()) { showMobilePage(pageNum - 1); return; }
    if (turning) { turning.classList.remove('turning'); turning = null; }
    if (pageNum <= 1) currentLocation = 0;
    else if (pageNum >= totalPages) currentLocation = numOfPapers;
    else currentLocation = Math.ceil((pageNum - 1) / 2);
    updateBookState();
  }

  function generateThumbnails() {
    thumbnailGrid.innerHTML = '';
    for (let i = 1; i <= modalMaxPages; i++) {
      const thumbnail = document.createElement('div');
      thumbnail.classList.add('thumbnail');
      thumbnail.dataset.page = i;
      thumbnail.setAttribute('role', 'button');
      thumbnail.setAttribute('tabindex', '0');
      const pagePreview = document.createElement('div');
      pagePreview.classList.add('page-preview');
      let contentId = (i % 2 !== 0) ? 'f' + Math.ceil(i / 2) : 'b' + (i / 2);
      const pageContent = document.getElementById(contentId);
      if (pageContent) pagePreview.appendChild(pageContent.cloneNode(true));
      const pageNumLabel = document.createElement('div');
      pageNumLabel.classList.add('thumb-page-num');
      pageNumLabel.textContent = i;
      thumbnail.appendChild(pagePreview);
      thumbnail.appendChild(pageNumLabel);
      const navigateToPage = () => { goToPage(parseInt(thumbnail.dataset.page, 10)); closeThumbnailView(); };
      thumbnail.addEventListener('click', navigateToPage);
      thumbnail.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToPage(); } });
      thumbnailGrid.appendChild(thumbnail);
    }
  }

  function openThumbnailView() { generateThumbnails(); thumbnailModal.classList.add('show'); setTimeout(() => closeModalBtn.focus(), 100); }
  function closeThumbnailView() { thumbnailModal.classList.remove('show'); allPagesBtn.focus(); }

  if (isMobileBook()) { showMobilePage(0); } else { updateBookState(); }

  mobileMQ.addEventListener('change', () => {
    currentLocation = 0;
    if (isMobileBook()) { showMobilePage(mobileIndex); } else { updateBookState(); }
  });
});
</script>
</body>
</html>
```

- [ ] **Step 5: Verify the reader file's script blocks are syntactically valid**

```bash
node --check books/reader.html
```

This will fail immediately because `node --check` doesn't understand HTML - extract just the two `<script>` blocks' contents into a temp `.js` file (concatenated) and run `node --check` on that instead, matching this project's established pattern for checking inline scripts. Expected: no syntax errors.

- [ ] **Step 6: Manual verification with hand-written test data**

Since no story has real `pages` data yet (migration is Task 10), temporarily insert one test story's `pages` directly via the Supabase SQL editor (or the `execute_sql` MCP tool, if available in your environment) using a small hand-built 3-page array:

```sql
update stories set data = data || jsonb_build_object('pages', jsonb_build_array(
  jsonb_build_object('id','pg-1','background',jsonb_build_object('type','gradient','value','#8C2620,#5E1712,160'),
    'layers',jsonb_build_array(jsonb_build_object('id','ly-1','type','text','content','Test Cover','x',10,'y',40,'w',80,'h',20,'style','heading','align','center','color','#fff','locked',false))),
  jsonb_build_object('id','pg-2','background',jsonb_build_object('type','color','value','#FDECEA'),
    'layers',jsonb_build_array(jsonb_build_object('id','ly-2','type','text','content','A middle page.','x',10,'y',40,'w',80,'h',20,'style','body','align','left','color','','locked',false))),
  jsonb_build_object('id','pg-3','background',jsonb_build_object('type','color','value','#FFF6E2'),
    'layers',jsonb_build_array(jsonb_build_object('id','ly-3','type','text','content','The end.','x',10,'y',40,'w',80,'h',20,'style','tag','align','left','color','','locked',false)))
))
where id = 'story-question-mark';
```

Then open `books/reader.html?story=story-question-mark` directly in the browser (not yet through the site's iframe stage - that's Task 9). Confirm: 2 physical papers render (3 pages = paper 1 front+back, paper 2 front-only with no back face in the DOM - inspect via dev tools to confirm no phantom hidden `.back` element exists on the second paper), text renders with correct styling per its `style` preset, clicking pages flips them, the "ALL PAGES" thumbnail grid shows exactly 3 thumbnails, and the browser console shows no errors. Then revert the test SQL update (set `pages` back to `[]` for that story) so Task 10's real migration isn't confused by leftover test data.

- [ ] **Step 7: Commit**

```bash
git add books/reader.html
git commit -m "Add the generic data-driven book reader"
```

---

## Task 9: Wire every book to the new reader

**Files:**
- Modify: `index.html:5614-5661` (`BOOKS`)

- [ ] **Step 1: Point every `BOOKS[].path` at the shared reader**

Change every `path:"books/<file>.html"` entry in the `BOOKS` array to `path:"books/reader.html?story=<id>"`, using each entry's own `id`. E.g.:

```js
    path: "books/reader.html?story=book-space-adventure"
```

and:

```js
    color:"#1273B0", colorDeep:"#0A5280", path:"books/reader.html?story=story-question-mark" },
```

...and so on for all 9 entries (`book-space-adventure`, `story-question-mark`, `story-fold-that-would-not`, `story-city-that-sank`, `story-drawing-nobody-understood`, `story-train-with-no-signals`, `story-song-in-the-rain`, `story-slowest-dancer`).

- [ ] **Step 2: `node --check`, then manual browser verification**

```bash
node --check index.html
```

In the browser: open `/stories`, click into "Chike and the Box That Wanted to Fly" (`story-question-mark` - the one with real test data from Task 8 Step 6, temporarily restored). Confirm it opens via `openGameStage()` into the sandboxed iframe exactly as every book does today, shows the same 3 test pages, and the flip/thumbnail/mobile controls all work identically to a book loaded from a static file. Revert the test data again afterward.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Point every book at the shared data-driven reader"
```

---

## Task 10: Migration script (parse-only, no network)

**Files:**
- Create: `supabase/migrate-book-pages.mjs`

- [ ] **Step 1: Write the parser**

This script only reads the 9 static HTML files and writes one local JSON file (`supabase/book-pages-migrated.json`) — it makes no network calls, following the same reasoning as Task 8's manual-SQL verification step: this project's `stories` table is admin-write-only under RLS (confirmed by this session's own earlier work establishing `is_active_admin()`-gated write policies), so the anon key this script would otherwise use cannot write the migrated result directly. Parsing is kept as a pure, deterministic, independently-testable step; applying it to the database is a separate, explicit step (Task 11) using whichever admin-authenticated path is available at execution time (the Supabase MCP connector's `execute_sql`, if available, or a service-role key supplied out-of-band).

Create `supabase/migrate-book-pages.mjs`:

```js
// One-time, re-runnable parser: reads the 9 hand-coded books/*.html files
// and converts each one's pages into the new structured {background,layers}
// format (see docs/superpowers/specs/2026-09-07-book-builder-design.md).
// Writes supabase/book-pages-migrated.json - it does NOT write to Supabase
// itself (the anon key cannot write to "stories", an admin-write-only
// table under this project's RLS - see that file's header comment for
// which category "stories" falls into). Apply the output separately,
// with an admin-authenticated path, per docs/superpowers/plans/
// 2026-09-07-book-builder.md Task 11.
//
// Usage: node supabase/migrate-book-pages.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const booksDir = path.join(here, "..", "books");

// storyId -> book filename, matching BOOKS[] in index.html.
const BOOK_FILES = {
  "book-space-adventure": "chike-and-zech-space-adventure.html",
  "story-question-mark": "story-question-mark.html",
  "story-fold-that-would-not": "story-fold-that-would-not.html",
  "story-city-that-sank": "story-city-that-sank.html",
  "story-drawing-nobody-understood": "story-drawing-nobody-understood.html",
  "story-train-with-no-signals": "story-train-with-no-signals.html",
  "story-song-in-the-rain": "story-song-in-the-rain.html",
  "story-slowest-dancer": "story-slowest-dancer.html"
};

function decodeEntities(s){
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&#8220;/g, "“").replace(/&#8221;/g, "”").replace(/&#8212;/g, "—")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function parseBackground(styleAttr){
  const gradMatch = styleAttr.match(/linear-gradient\((\d+)deg,\s*([^\s]+)\s*0%,\s*([^\s]+)\s*100%\)/);
  if (gradMatch) return { type:"gradient", value: gradMatch[2] + "," + gradMatch[3] + "," + gradMatch[1] };
  const colorMatch = styleAttr.match(/background-color:\s*(#[0-9A-Fa-f]{3,6})/);
  if (colorMatch) return { type:"color", value: colorMatch[1] };
  return { type:"color", value:"#FFF6E2" };
}

let uidSeq = 0;
function uid(prefix){ uidSeq += 1; return prefix + "-mig-" + uidSeq; }

function parsePageContentBlock(block){
  const styleMatch = block.match(/<div class="page-content"[^>]*style="([^"]*)"/);
  const background = parseBackground(styleMatch ? styleMatch[1] : "");
  const layers = [];

  const isCover = /cover-title/.test(block);
  if (isCover){
    const titleMatch = block.match(/<div class="cover-title">([\s\S]*?)<\/div>/);
    if (titleMatch){
      layers.push({ id: uid("ly"), type:"text",
        content: decodeEntities(titleMatch[1].replace(/<br>/g, " ").replace(/<em>|<\/em>/g, "").replace(/<[^>]+>/g, "")),
        x:10, y:38, w:80, h:30, style:"heading", align:"left", color:"#fff", locked:false });
    }
  }

  const tagMatch = block.match(/<span class="moral-tag">([\s\S]*?)<\/span>/);
  if (tagMatch){
    layers.push({ id: uid("ly"), type:"text", content: decodeEntities(tagMatch[1]),
      x:10, y:20, w:80, h:10, style:"tag", align:"left", color:"", locked:false });
  }

  const h3Matches = [...block.matchAll(/<h3([^>]*)>([\s\S]*?)<\/h3>/g)];
  h3Matches.forEach((m, idx) => {
    const isItalic = /font-style:italic/.test(m[1]);
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ""));
    layers.push({ id: uid("ly"), type:"text", content: text,
      x:10, y: isCover ? (70 + idx * 8) : (35 + idx * 30), w:80, h:25,
      style: isItalic ? "quote" : (isCover ? "heading" : "body"),
      align:"left", color: isCover ? "#fff" : "", locked:false });
  });

  const imgMatch = block.match(/<img src="([^"]*)" alt="([^"]*)"/);
  if (imgMatch){
    layers.push({ id: uid("ly"), type:"image", src: imgMatch[1], alt: decodeEntities(imgMatch[2]), placement:"bottom-half" });
  }

  return { id: uid("pg"), background, layers };
}

function parseBook(html){
  // Only real, visible page-content blocks - deliberately excludes the
  // known "Hidden Page" dummy back face (aria-hidden="true") some of these
  // files carry, since that content was never meant to be a real page.
  const blocks = [...html.matchAll(/<div class="page-content"[\s\S]*?<\/div><\/div>/g)]
    .map(m => m[0])
    .filter(b => !/aria-hidden="true"/.test(b));
  return blocks.map(parsePageContentBlock);
}

function main(){
  const out = {};
  for (const [storyId, filename] of Object.entries(BOOK_FILES)){
    const filePath = path.join(booksDir, filename);
    const html = readFileSync(filePath, "utf-8");
    const pages = parseBook(html);
    out[storyId] = pages;
    console.log(storyId + ": " + pages.length + " pages parsed from " + filename);
  }
  const outPath = path.join(here, "book-pages-migrated.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote " + outPath);
}

main();
```

- [ ] **Step 2: Run it and sanity-check the output**

```bash
node supabase/migrate-book-pages.mjs
```

Expected: 8 lines of `<storyId>: N pages parsed from <file>.html` (not 9 - `book-space-adventure` has no `stories` record to attach to per the design spec's note that it's the one flagship book without a matching story; it's handled separately in Task 11), then `Wrote supabase/book-pages-migrated.json`.

Open the JSON file and manually read through 2-3 entries end to end (e.g. `story-fold-that-would-not`, the file read in full during design): confirm the cover page's heading text matches, confirm the italic opening line became a `"quote"`-style layer, confirm the `.moral-tag` text became a `"tag"`-style layer, confirm image `src`/`alt` values match the original `<img>` tags, and confirm each book has exactly 7 pages (matching every `BOOKS[].pages` value today) - not 8, i.e. the hidden dummy page was correctly excluded.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrate-book-pages.mjs supabase/book-pages-migrated.json
git commit -m "Add the book-pages migration parser and its output"
```

(The generated JSON is committed too, deliberately - Task 11 applies it against production and it's worth keeping as a record of exactly what was migrated, the same way `supabase/seed-data.json` is already committed.)

---

## Task 11: Apply the migration, verify, retire the old static files

**Files:**
- Modify: production Supabase `stories` table (via whichever admin-authenticated path is available: the Supabase MCP connector's `execute_sql`, or a service-role script run out-of-band)
- Modify: `index.html:5614-5627` (the `book-space-adventure` `BOOKS` entry - see Step 3)
- Delete: `books/chike-and-zech-space-adventure.html`, `books/story-question-mark.html`, `books/story-fold-that-would-not.html`, `books/story-city-that-sank.html`, `books/story-drawing-nobody-understood.html`, `books/story-train-with-no-signals.html`, `books/story-song-in-the-rain.html`, `books/story-slowest-dancer.html`

- [ ] **Step 1: Apply `book-pages-migrated.json` to each story's `pages` field**

For each of the 8 keys in `supabase/book-pages-migrated.json`, update that `stories` row's `data` to merge in the parsed `pages` array (full merge of existing `data`, not a partial write, since a raw SQL `update ... set data = data || jsonb_build_object('pages', ...)` is a safe *shallow* merge at the top level and `pages` is a new top-level key that doesn't exist yet - it cannot clobber any other field). Whoever executes this task should read the actual JSON output from Task 10 and either issue one `execute_sql` call per story (readable, easy to verify each one individually) or a single script that loops over the JSON file - eight individual statements shaped like:

```sql
update stories set data = data || jsonb_build_object('pages', '<pages array JSON for this story, from book-pages-migrated.json>'::jsonb)
where id = 'story-fold-that-would-not';
```

- [ ] **Step 2: Visual regression check, book by book**

For each of the 8 migrated stories: open the *old* static file directly (e.g. `books/story-fold-that-would-not.html` in a browser tab) and the *new* reader for the same story (`books/reader.html?story=story-fold-that-would-not`) side by side. Step through every page in both and compare: background color/gradient matches, text content and general position/emphasis (heading vs. body vs. italic vs. tag) reads the same, images appear in roughly the same place. Minor positional differences are expected and fine (the parser uses reasonable defaults, not pixel-exact extraction - the whole point of the builder is that these are now easy to nudge afterward) - what matters is nothing is missing, garbled, or wildly mispositioned. Note anything that needs a manual touch-up in the builder after cutover.

- [ ] **Step 3: Handle `book-space-adventure` (no matching `stories` record)**

Per the design spec, this is the one flagship book with no matching `stories` row (`findBook()`'s comment already notes every other `BOOKS` entry shares its id with a `stories` record; this one doesn't). Two choices, pick based on how much content it has: if `books/chike-and-zech-space-adventure.html` follows the same page-content structure as the other 8 (verify by opening it), run it through the same `parseBook()` function from Task 10 as a one-off (`node -e` snippet, or a tiny addition to the script), and create a **new** `stories` record for it via `db.add` (matching the design spec's note that this was already flagged as a reasonable option) so it can go through the same reader and builder as everything else. Otherwise, if its structure differs meaningfully, leave that one file as its own static page for now (update nothing) and note it as an explicit follow-up - don't force a mismatched structure through the parser just for consistency.

- [ ] **Step 4: Delete the old static files once every migrated book is confirmed correct**

Only after Step 2's comparison passes for all 8 stories (and Step 3 is resolved one way or the other):

```bash
git rm books/story-question-mark.html books/story-fold-that-would-not.html books/story-city-that-sank.html books/story-drawing-nobody-understood.html books/story-train-with-no-signals.html books/story-song-in-the-rain.html books/story-slowest-dancer.html
```

(Omit `books/chike-and-zech-space-adventure.html` from this command if Step 3 concluded it stays static.)

- [ ] **Step 5: Full site smoke test**

In the browser: visit `/stories`, open every one of the 8 (or 9) books from the library grid, confirm each one opens, flips, and shows the thumbnail grid correctly with real content (not test data). Open `/admin/stories`, open the builder for 2-3 of them, confirm the migrated pages/layers show up correctly as editable filmstrip pages, canvas content, and layer-panel rows - not just correct in the read-only reader, but genuinely editable (drag a migrated text layer, confirm it moves).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Migrate all existing books to the data-driven format, retire static files"
```

---

## Task 12: Final polish and full verification pass

**Files:** none new - verification only, plus any fixes surfaced by it

- [ ] **Step 1: `node --check` on both files one more time**

```bash
node --check index.html
```

(extract the inline script first, per this project's standing convention) and confirm `books/reader.html`'s two script blocks are still syntactically clean (per Task 8 Step 5's extraction method).

- [ ] **Step 2: Run the full in-app `/test` suite**

Open `#/test`, run all checks, confirm the accepted baseline still holds (this project's documented baseline: the pre-existing Spacetime-sandbox-simulator missing-CSS failure is the only accepted non-pass) and that the three new "Story pages" tests from Task 1 still pass.

- [ ] **Step 3: Confirm the odd-page-count fix end to end**

In the builder, take any migrated 7-page book (an odd count) and check its reader output in dev tools: confirm the final `.paper`'s `.back` element does not exist in the DOM at all (not present-but-hidden - genuinely absent, per `buildPapers()`'s `if (backPage)` guard in Task 8). Confirm `atLastPage` still fires correctly on the true last page by watching for the `postMessage({source:'ccs-book', atLastPage:true})` event (e.g. via a `window.addEventListener('message', console.log)` in the parent page's dev console) when reaching the final page - this is what gates the "Write your own ending" button on the site's own reading stage, so it must still fire at exactly the right moment.

- [ ] **Step 4: Confirm nothing broke for a signed-out visitor**

Sign out of admin, visit `/stories`, open a couple of books, confirm the public reading experience is completely unaffected - no admin-only UI leaks into the reader, no console errors, no broken images.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "Book builder: final verification pass"
```

If Step 2 or Step 3 surfaces a real regression, fix it, re-verify, and commit the fix separately before considering this plan complete.

