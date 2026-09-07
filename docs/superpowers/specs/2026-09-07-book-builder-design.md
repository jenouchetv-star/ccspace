# Admin Book Builder: a layered page editor for stories

## Context

Every picture-book story ("Zech's Paper Airplane Parade" and 8 others, including the
flagship "Chike and Zech's Space Adventure") is currently a fully hand-coded, standalone
HTML file under `/books/` — roughly 650 lines each of hardcoded CSS, page-flip animation
JS, and page content baked directly into the markup (`<div class="page-content" ...>` with
inline `style="background-color:..."`, `<h3>` text, and the occasional `<img>`). These
files are loaded into a sandboxed iframe via `openGameStage()` (`index.html:7937`), the
exact same mechanism used for embed games — `BOOKS[].path` (`index.html:5614`) just points
at the static file.

The `stories` collection (`FIELDS.stories`, `index.html:9218`) only has metadata fields
today — title, character, age range, blurb, opening line, discovery, growth value, linked
activity, cover image, featured flag. None of it touches the actual page-by-page book
content shown in the reader. Adding a page, moving a page, or changing what's on a page
today means hand-editing the static HTML file directly — no admin path exists at all.

The user asked for an intuitive backend book-builder: add pages, move pages, add photos,
set a page's background image (including animated GIFs), place and move text, edit text,
view the page as layers, and lock/unlock layers. Confirmed through discussion:

- **Scope**: applies to both new books going forward AND the 9 existing books, which get
  migrated into the new system so they become editable too.
- **The image/text split**: the user does not want to fuss over precise image
  positioning/sizing (images, especially AI-generated ones, aren't something they want
  fine pixel control over) — images pick a placement **preset** (full background,
  top-half, bottom-half, inset-left/right/center). **Text is the one thing that needs
  genuine freeform control**: drag anywhere, resize, reorder in z-order, lock in place.
- **Architecture**: build the real layered/freeform data model now (not a cheaper
  templates-only version), since it maps cleanly onto the reader's existing fixed-aspect
  page box (pages already scale as one unit at every size — the thumbnail modal already
  proves this, rendering pages at `transform:scale(0.2)`) — percentage-based layer
  coordinates scale with it for free, the same way PowerPoint/Canva slides work.

## What already exists and gets reused directly

- **The page-flip engine itself** (`.paper`/`.front`/`.back`/`.book-container.opened`
  transforms, the thumbnail-grid modal, the single-page mobile reader mode, the
  `postMessage({source:'ccs-book', atLastPage})` handshake with the parent page) — all of
  this is pure CSS/JS scaffolding around whatever HTML sits inside `.page-content`. None
  of it needs to change; the new generic reader reuses every line of it verbatim.
- **`openGameStage()`/`closeGameStage()`** (`index.html:7937`) — the sandboxed-iframe
  embed mechanism. Unchanged; only what `path` points to changes.
- **`BOOKS`/`findBook()`** (`index.html:5614-5661`) — stays as the small per-book metadata
  overlay (icon, accent color, blurb-for-the-library-card) it already is; only `path`
  changes for every entry, from a unique static file to the one shared reader.
- **The media library** (`uploadToStorage()`, `mediaControl()`, `openMediaPicker()`,
  `index.html` ~11058-11134) — reused as-is for choosing/uploading a page's background
  image, background GIF, or an inset image. GIFs need no special handling beyond allowing
  the extension through the upload/picker filters — browsers animate an `<img src="*.gif">`
  natively, same as a static image.
- **`FIELDS.stories`/`BLANKS.stories`** (`index.html:9218`) — the existing metadata editor
  stays exactly as it is; the builder is a separate, dedicated screen linked from here (a
  new "Build pages" button on the story's edit modal / admin list row), not a replacement
  for it.
- **`is_active_admin()` / the admin route gate** — the new builder route sits under
  `/admin/...` like every other admin screen, no new auth model needed.

## Data model

A new `pages` field is added to each `stories` record (default: empty array in
`BLANKS.stories`, meaning "not migrated / not started yet" renders as a friendly empty
state in the builder, not a broken reader):

```js
data.pages = [
  {
    id: "pg-...",                       // stable id, survives reordering
    background: {
      type: "color" | "gradient" | "image" | "gif",
      value: "#FDECEA"                  // hex for color; "c1,c2,angle" for gradient;
                                         // a media path for image/gif
    },
    layers: [
      {
        id: "ly-...",
        type: "text",
        content: "“This is the fastest plane in the neighborhood,” Zech announced.",
        x: 8, y: 62, w: 84, h: 24,       // percentages of the page box
        style: "heading" | "body" | "quote" | "tag",   // matches today's h1/h3/quote/moral-tag
        align: "left" | "center",
        color: "" ,                      // "" = inherit from style preset
        locked: false,
        zOrder: 0                        // position within layers[] IS the z-order;
                                          // kept explicit for clarity in the layers panel
      },
      {
        id: "ly-...",
        type: "image",
        src: "/assets/characters/zech.jpg",
        alt: "Zech folding a bright blue paper airplane",
        placement: "full-bg" | "top-half" | "bottom-half" | "inset-left" | "inset-right" | "inset-center",
        zOrder: 1
      }
    ]
  },
  // ...one entry per page, array order = page order
]
```

An image layer with `placement:"full-bg"` is a convenience for "this photo fills the
page" without needing a second background mechanism — the builder offers both a
background picker (color/gradient/image/gif for the page's base fill) and, separately,
image layers for anything that should sit in front of text or only cover part of the
page. This keeps one mental model ("everything on a page is either the background or a
layer on top of it") instead of two competing image systems.

**Fixing the "hidden page" hack.** Today's static files force an odd visible page count
(e.g. 7) using an even number of physical two-sided "papers," so the very last physical
sheet has a real front page and a `aria-hidden="true"` dummy back page that's never
meant to be seen (`story-fold-that-would-not.html:446-452`). The new generic reader
computes physical paper count from `Math.ceil(pages.length / 2)` and, when `pages.length`
is odd, renders the final paper with a genuinely blank/absent back face (removed from the
DOM, not hidden-but-present) rather than a fake "Hidden Page" placeholder — a real
correctness fix that falls out of making the reader data-driven instead of hand-written
per book.

## The reader becomes one shared, generic file

`books/reader.html` (new) replaces all 9 existing per-book static files. It:

1. Reads a `?story=<id>` query param (set by `BOOKS[].path`, e.g.
   `books/reader.html?story=story-fold-that-would-not`).
2. Fetches that story's record from Supabase directly via the public REST endpoint using
   the same anon key already shipped in `index.html` (`stories` is public-read, per the
   existing RLS setup — no new access needed).
3. Renders the exact same `.book`/`.paper`/`.front`/`.back`/`.page-content` DOM structure
   the static files use today, generating each `.page-content` from that page's
   `background` + `layers` instead of from hardcoded HTML — a text layer becomes a
   positioned `<div>` (`position:absolute; left:x%; top:y%; width:w%; height:h%`) styled
   per its preset. Today's files are less varied than "four distinct classes" suggests —
   in practice almost every line of narrative text is just `<h3>` (occasionally with
   inline `font-style:italic`), the cover uses its own one-off `.cover-title`/`.cover-mark`/
   `.cover-foot` treatment, and `.moral-tag` is a small label placed *above* a closing
   `<h3>`, not a replacement for it. The four builder presets generalize this rather than
   reuse it literally: **Heading** → the cover-title-sized treatment, **Body** → plain
   `h3`, **Quote** → `h3` + italic, **Tag-label** → the small `.moral-tag` pill (typically
   paired with a Body/Heading layer underneath it, not used alone). An image layer with
   `placement:"full-bg"` becomes a full-bleed `<img>` or background-image; other
   placements become an appropriately-sized/positioned `<img>`.
4. Keeps every other line of the existing engine (flip physics, thumbnail modal, mobile
   single-page mode, keyboard nav, the `postMessage` handshake) unchanged — this part of
   the file is close to a direct copy of today's shared boilerplate, not a rewrite.

`BOOKS[].path` (`index.html:5614`) changes from a unique file per book to
`books/reader.html?story=<id>` for every entry. `findBook()`/`BOOKS` itself is untouched
otherwise (still the small per-library-card metadata: icon, accent color, blurb).

## The admin Book Builder UI

New screen, `#/admin/stories/:id/build` (linked via a "Build pages" button on the
existing story edit modal, `openEditor("stories", id)`). Three panels, all built from
scratch on this project's existing admin design language (`.admin-*` classes already
established for Launch Readiness / the rest of the admin portal, per the earlier
admin-portal redesign work this session):

- **Left — page filmstrip.** A thumbnail per page (a small live-rendered preview, same
  scale-transform trick the existing thumbnail modal already uses), stacked top to
  bottom. Drag to reorder (this is the "move pages" ask). A "+" button adds a page
  (blank, or "duplicate this page" as a starting point). A delete icon per thumbnail
  (behind the existing `confirmDelete()` pattern, since removing a page is destructive).
- **Center — canvas.** The selected page, rendered at its real aspect ratio (matching
  `--book-height`/`--book-width`'s `1/1.44` ratio from the reader CSS). A background
  control strip above it: color swatch, gradient picker (two colors + angle, matching
  today's existing gradient covers), or "choose image/GIF" (opens the existing media
  picker). Text layers render as draggable, resizable boxes directly on the canvas —
  click to select, drag to reposition, a corner handle to resize, double-click (or an
  edit icon on the selected box) to edit the text inline. A "+ Add text" button drops a
  new box at a sensible default position/size. Image layers show their chosen placement
  preset directly on the canvas (not draggable — placement is picked from the preset
  list in the layers panel, per the confirmed image/text split) with a border and label
  when selected.
- **Right — layers panel.** Every layer on the current page, listed top to bottom in the
  same order as their z-order (top of the list = front-most). Drag to reorder (changes
  what's drawn on top of what). Each row: a lock icon (locked = the layer's box can't be
  dragged, resized, or deleted from the canvas until unlocked again, but its text can
  still be edited via the panel — matching "lock the position, not the content"), and
  for a text layer, a style dropdown (Heading / Body / Quote / Tag-label — the four
  presets already used across every existing book) plus an alignment toggle. For an
  image layer, the placement-preset dropdown lives here instead of on the canvas.

## Migrating the 9 existing books

A one-time Node script (not a user-facing admin tool) parses each of the 9 static HTML
files — extracting each `.page-content`'s background style, `<h3>`/`<h1>`/`.moral-tag`
text and which preset it maps to, and any `<img>`'s `src`/`alt` and rough vertical
position — and writes the equivalent `pages` array into that story's Supabase record.
After migration, every static file's rendered output gets screenshotted and compared
side-by-side against the new data-driven reader's output for the same story, page by
page, before the static `/books/*.html` files (other than the new shared
`reader.html`) are deleted — a real regression check, not an assumption that the parser
got every page right.

## Explicitly out of scope for this pass

- **Freeform positioning for images** — confirmed out of scope; images use placement
  presets, not drag/resize, per the user's own stated preference.
- **Rotation, opacity, or advanced text styling** (custom fonts beyond the 4 presets,
  per-character formatting, drop shadows) — the 4 existing style presets (Heading / Body
  / Quote / Tag-label) already cover every page across all 9 current books; adding more
  granular typographic control is a fast-follow if it turns out to be needed once the
  builder is in real use.
- **Multiple background images per page / parallax / video backgrounds** — one
  background (color, gradient, image, or GIF) per page, matching what exists today.
- **Undo/redo history in the builder** — saves are explicit (a Save button, following
  this app's existing `db.update()` pattern); relying on the underlying record's
  `updatedAt` and the admin's own care rather than building a full undo stack for v1.

## Critical files

- `index.html` — `BOOKS`/`findBook()` (5614-5661, `path` values updated),
  `openGameStage()`/`closeGameStage()` (7937, unchanged), `FIELDS.stories`/
  `BLANKS.stories` (9218, new `pages` field + "Build pages" entry point), the new
  `#/admin/stories/:id/build` route and its render function, `ADMIN_NAV`/route dispatch,
  `uploadToStorage()`/`mediaControl()`/`openMediaPicker()` (~11058-11134, reused for
  background/image pickers).
- `books/reader.html` (new) — the single generic reader replacing all 9 static files;
  reuses the flip/thumbnail/mobile-reader CSS+JS from today's static files near-verbatim.
- `books/*.html` (existing 9 files) — deleted once migration is verified, except the new
  shared `reader.html`.
- A new one-time Node migration script (not committed as a permanent admin tool) to
  parse and convert the 9 existing books.
- `supabase/migration.sql` — no schema change needed (`stories.data` is already `jsonb`;
  `pages` is just a new key within it), but worth a comment noting the new field shape
  for future reference.

## Verification

- `node --check` the extracted inline script after each block of client-side changes.
- Build a brand-new book end to end in the builder: add several pages, add and freely
  move/resize/restyle text layers, set a color background on one page and an image
  background on another, add an inset image layer, reorder pages, lock a layer and
  confirm it can no longer be dragged until unlocked, delete a page, save, reload the
  admin screen and confirm everything persisted exactly.
- Confirm the public reader (`books/reader.html?story=...`) renders that new book
  correctly inside the sandboxed iframe stage, with the flip animation, thumbnail grid,
  and mobile single-page mode all working exactly as they do today for every other book.
- After migrating the 9 existing books: page-by-page screenshot comparison between each
  old static file and the new data-driven render, for every book, before deleting the
  old files.
- Confirm the odd-page-count fix: a book with an odd number of pages renders its final
  physical sheet with no visible/hidden dummy back face, and `atLastPage` still fires
  correctly via the `postMessage` handshake on the true last page.
- Re-run `/test`, confirm the accepted baseline still holds.
