// One-time, re-runnable parser: reads the 8 hand-coded books/*.html files
// and converts each one's pages into the new structured {background,layers}
// format (see docs/superpowers/specs/2026-09-07-book-builder-design.md).
// Writes supabase/book-pages-migrated.json - it does NOT write to Supabase
// itself (the anon key cannot write to "stories", an admin-write-only
// table under this project's RLS). Apply the output separately, with an
// admin-authenticated path, per docs/superpowers/plans/
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
  const gradMatch = styleAttr.match(/linear-gradient\((\d+)deg,\s*([^\s,]+)(?:\s*0%)?,\s*([^\s,)]+)(?:\s*100%)?\)/);
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
    const isWhite = /color:\s*#fff/.test(m[1]);
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ""));
    layers.push({ id: uid("ly"), type:"text", content: text,
      x:10, y: isCover ? (70 + idx * 8) : (35 + idx * 30), w:80, h:25,
      style: isItalic ? "quote" : (isCover ? "heading" : "body"),
      align:"left", color: (isCover || isWhite) ? "#fff" : "", locked:false });
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
