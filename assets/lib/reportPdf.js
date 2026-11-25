// Chike's Creative Space - the progress report as a PDF file (owner, 2026-11-24: "Instead of print, show export pdf.
// create a custom pdf design using HTML and convert it to a pdf file"). The look is
// docs/mockups/progress-report-pdf-draft.html: US Letter, the library sheet's document style, the site's level dots.
//
// This file has no DOM, network or database: index.html builds the model from the report (parentReport), lays these
// pages out off screen, draws each with html2canvas, and hands the pictures to pdfFromJpegs. Every word is escaped here.

const E = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The pages' own styles, scoped to .rpdf (they never touch the site). A page is 8.5 x 11 inches at 96 dpi. */
export const REPORT_PDF_CSS = `
.rpdf, .rpdf *{ box-sizing:border-box; }
.rpdf{ --ink:#1E2226; --soft:#4A5258; --mute:#6B7378; --blue:#1273B0; --sun:#F2C230; --green:#2F6B2C; --cream:#FAF4E6; --line:#E3DED2; --grey:#A7ADB2;
  font:400 13.3px/1.5 "Plus Jakarta Sans", system-ui, sans-serif; color:var(--ink); }
/* one class: beats the site's own element styles (p, h1, ...), and each part's own spacing below, written later, wins */
.rpdf :where(h1, h2, h3, p, ul, ol, table){ margin:0; }
.rpdf-page{ width:816px; height:1056px; background:#FFFFFF; display:flex; flex-direction:column; padding:53px 58px 43px; overflow:hidden; }
.rpdf-body{ flex:1; min-height:0; overflow:hidden; }
.rpdf-head{ display:grid; grid-template-columns:1fr auto; align-items:end; gap:28px; padding-bottom:21px; border-bottom:2px solid var(--ink); }
.rpdf-logo{ height:60px; width:auto; display:block; margin-bottom:19px; }
.rpdf-kicker{ font-size:12.6px; font-weight:700; color:var(--blue); }
.rpdf h1{ font-size:40px; line-height:1.05; letter-spacing:-.022em; font-weight:800; margin-top:2px; }
.rpdf-head2 h1{ font-size:26px; }
.rpdf-who{ text-align:right; font-size:12.6px; line-height:1.55; color:var(--soft); }
.rpdf-who b{ color:var(--ink); font-size:14.6px; display:block; }
.rpdf-week{ margin:25px 0 28px; font-size:16.6px; line-height:1.55; }
.rpdf-week span{ display:block; margin-top:6px; font-size:13.3px; color:var(--soft); }
.rpdf h2{ font-size:16px; font-weight:800; letter-spacing:-.005em; margin:0 0 4px; }
.rpdf-sub{ color:var(--mute); font-size:12px; margin:0 0 11px; }
.rpdf table{ width:100%; border-collapse:collapse; font-size:12.8px; }
.rpdf th{ text-align:left; font-size:11.2px; font-weight:700; color:var(--mute); padding:0 12px 7px 0; border-bottom:1.5px solid var(--ink); white-space:nowrap; }
.rpdf td{ padding:9px 10px 9px 0; border-bottom:1px solid var(--line); vertical-align:top; }
.rpdf td:first-child{ font-weight:800; width:140px; }
.rpdf td.rpdf-from{ color:var(--soft); }
.rpdf tr.rpdf-none td{ color:var(--mute); }
.rpdf tr.rpdf-none td:first-child{ color:var(--soft); }
.rpdf tr.rpdf-reading td{ border-top:1.5px solid var(--ink); }
/* the level: a dot and the word. The dot is a character in the line (filled, or hollow for not enough evidence), so
   html2canvas sets it on the same baseline as the word */
.rpdf-st{ font-weight:700; white-space:nowrap; }
.rpdf-st i{ font-style:normal; color:var(--c); margin-right:6px; font-size:19px; line-height:12px; }
.rpdf-st--none i{ font-size:13px; }
.rpdf-st--cons{ --c:#2F6B2C; }
.rpdf-st--prac{ --c:#F2C230; }
.rpdf-st--dev{ --c:#1273B0; }
.rpdf-st--none{ --c:#A7ADB2; font-weight:600; color:var(--mute); }
.rpdf-note{ margin-top:22px; background:var(--cream); border-radius:12px; padding:17px 21px; display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.rpdf-note--one{ grid-template-columns:1fr; }
.rpdf-note h3{ font-size:13.3px; font-weight:800; margin-bottom:5px; }
.rpdf-note p, .rpdf-note li{ color:var(--soft); font-size:12.3px; line-height:1.5; }
.rpdf-note p + h3{ margin-top:10px; }
.rpdf-note .rpdf-lv + .rpdf-lv{ margin-top:3px; }
.rpdf-sec{ margin-top:25px; }
.rpdf-q{ display:grid; grid-template-columns:110px 1fr; gap:17px; padding:12px 0; border-bottom:1px solid var(--line); }
.rpdf-q .rpdf-subj{ font-weight:800; font-size:12.3px; }
.rpdf-q .rpdf-subj span{ display:block; font-weight:500; color:var(--mute); font-size:11.5px; }
.rpdf-q h3{ font-size:13.6px; font-weight:700; line-height:1.35; }
.rpdf-q p{ color:var(--soft); font-size:12.4px; margin-top:2px; }
.rpdf-q p b{ color:var(--ink); }
.rpdf-day{ padding:9px 0; border-bottom:1px solid var(--line); }
.rpdf-day h3{ font-size:12.6px; font-weight:800; margin-bottom:3px; }
.rpdf-day ul{ padding:0; list-style:none; }
.rpdf-day li{ font-size:12.1px; color:var(--soft); line-height:1.5; display:flex; justify-content:space-between; gap:14px; }
.rpdf-day li span{ color:var(--mute); white-space:nowrap; }
.rpdf-empty{ color:var(--mute); font-size:12.4px; padding:6px 0 4px; }
.rpdf-how{ margin-top:18px; font-size:12px; color:var(--soft); line-height:1.55; }
.rpdf-how b{ color:var(--ink); }
.rpdf-foot{ margin-top:14px; padding-top:13px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:11.2px; color:var(--mute); }
`;

const head = (m, small) => '<div class="rpdf-head' + (small ? " rpdf-head2" : "") + '"><div>'
  + (small ? "" : '<img class="rpdf-logo" src="/assets/brand/logo.webp" alt="Chike’s Creative Space">')
  + '<span class="rpdf-kicker">Progress report</span><h1>' + E(small ? m.name + ", " + m.shortPeriod : m.name) + '</h1></div>'
  + '<div class="rpdf-who"><b>' + E(m.grade) + '</b>' + (small ? "" : E(m.periodLabel) + '<br>Made on ' + E(m.madeOn)) + '</div></div>';

/** Page 1: who and which week, the report's own summary, each subject's level, then what to practice and what the
    levels mean. */
export function reportPdfFirstPage(m) {
  const rows = (m.subjects || []).map((s) => '<tr class="' + (s.label === "Reading and Writing" ? "rpdf-reading" : s.status === "none" ? "rpdf-none" : "") + '">'
    + '<td>' + E(s.label) + '</td><td><span class="rpdf-st rpdf-st--' + E(s.status) + '"><i>' + (s.status === "none" ? "○" : "●") + '</i>' + E(s.statusLabel) + '</span></td>'
    + '<td>' + E(s.n) + '</td><td>' + (s.ownPct == null ? "-" : E(s.ownPct) + "%") + '</td>'
    + '<td class="rpdf-from">' + (s.from && s.from.length ? E(s.from.join(", ")) : "-") + '</td></tr>').join("");
  const practice = (m.practice || []).length
    ? '<div><h3>Worth practicing</h3>' + m.practice.map((p) => '<p><b>' + E(p.title) + '</b>: ' + E(p.text) + (p.tip ? " " + E(p.tip) : "") + '</p>').join("") + '</div>'
    : "";
  const levels = '<div><h3>What the levels mean</h3><p class="rpdf-lv"><b>Developing</b>: under 60% on their own</p><p class="rpdf-lv"><b>Practicing</b>: 60 to 84% on their own</p>'
    + '<p class="rpdf-lv"><b>Consistently demonstrated</b>: 85% or more on their own, from 2 or more games, books or activities</p></div>';
  return head(m, false)
    + '<p class="rpdf-week">' + E(m.verdict) + (m.verdictSub ? '<span>' + E(m.verdictSub) + '</span>' : "") + '</p>'
    + '<h2>By subject</h2><p class="rpdf-sub">Each subject’s level comes from the answers in this report’s period.</p>'
    + '<table><thead><tr><th>Subject</th><th>Level</th><th>Answers</th><th>On their own</th><th>From</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="rpdf-note' + (practice ? "" : " rpdf-note--one") + '">' + practice + levels + '</div>';
}

/** Everything after page 1, as blocks the pages fill in order: a section's heading travels with its first entry. */
export function reportPdfBlocks(m) {
  const blocks = [];
  const name = E(m.name);
  const qHead = '<div class="rpdf-sec"><h2>Questions to go over</h2><p class="rpdf-sub">The ones ' + name + ' missed or needed a hint for, with the right answer.</p>';
  const qs = (m.questions || []).map((q) => '<div class="rpdf-q"><div class="rpdf-subj">' + E(q.subject) + '<span>' + E(q.from) + '</span></div>'
    + '<div><h3>' + E(q.question) + '</h3><p>'
    + (q.hinted ? "Right after a hint. " : q.gave ? name + ' answered <b>' + E(q.gave) + '</b>. ' : "")
    + 'The answer is <b>' + E(q.answer) + '</b>.' + (q.why ? " " + E(q.why) : "") + '</p></div></div>');
  if (qs.length) qs.forEach((q, i) => blocks.push((i === 0 ? qHead : "") + q + (i === 0 ? "</div>" : "")));
  else blocks.push(qHead + '<p class="rpdf-empty">Nothing to go over: every answer was right on ' + name + '’s own.</p></div>');

  const dHead = '<div class="rpdf-sec"><h2>Everything ' + name + ' did</h2>';
  const ds = (m.days || []).map((d) => '<div class="rpdf-day"><h3>' + E(d.label) + '</h3><ul>'
    + d.items.map((it) => '<li>' + E(it.title) + '<span>' + E(it.detail) + '</span></li>').join("") + '</ul></div>');
  if (ds.length) ds.forEach((d, i) => blocks.push((i === 0 ? dHead : "") + d + (i === 0 ? "</div>" : "")));
  else blocks.push(dHead + '<p class="rpdf-empty">Nothing was recorded in this period.</p></div>');

  blocks.push('<p class="rpdf-how"><b>How levels are set.</b> Games, books, episodes and activities ask short questions at ' + name
    + '’s grade. A subject gets a level once ' + name + ' answers 5 of its questions, and Consistently demonstrated needs answers from at least 2 different places. '
    + 'Only you can see this report.</p>');
  return blocks;
}

/** A page around a body: the footer names the site and the page. Page 2 on carry a small heading (see head). */
export function reportPdfPage(inner, n, total) {
  return '<section class="rpdf-page"><div class="rpdf-body">' + inner + '</div>'
    + '<div class="rpdf-foot"><span>Chike’s Creative Space, chikescreativespace.com</span><span>Page ' + n + ' of ' + total + '</span></div></section>';
}
/** The small heading at the top of page 2 on. */
export function reportPdfContinued(m) { return head(m, true); }

/** "Maya-progress-report-2026-11-17.pdf": letters, numbers and hyphens only. */
export function pdfFileName(name, day) {
  const who = String(name || "").replace(/['’]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const when = /^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) ? "-" + day : "";
  return (who ? who + "-" : "") + "progress-report" + when + ".pdf";
}

/** A PDF of whole-page pictures: each JPEG fills one US Letter page (612 x 792 points), in order. The JPEG bytes go in
    as they are (DCTDecode). info.title is kept to plain printable characters. Returns the file's bytes. */
export function pdfFromJpegs(pages, info = {}) {
  const enc = (s) => Uint8Array.from(String(s), (c) => c.charCodeAt(0) & 255);
  const parts = [];
  let length = 0;
  const offsets = [];
  const push = (u8) => { parts.push(u8); length += u8.length; };
  const obj = (n, dict, stream) => {
    offsets[n] = length;
    push(enc(n + " 0 obj\n" + dict + "\n"));
    if (stream) { push(enc("stream\n")); push(stream); push(enc("\nendstream\n")); }
    push(enc("endobj\n"));
  };
  push(enc("%PDF-1.4\n"));
  push(Uint8Array.of(37, 226, 227, 207, 211, 10));   /* %âãÏÓ: tells readers the file holds binary data */

  const n = pages.length;
  /* 1 catalog, 2 pages, 3 info, then per page: the page, its drawing, its picture */
  const pageNum = (i) => 4 + i * 3;
  const title = String(info.title || "").replace(/[’‘]/g, "'").replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, (c) => "\\" + c);
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [" + pages.map((_, i) => pageNum(i) + " 0 R").join(" ") + "] /Count " + n + " >>");
  obj(3, "<< /Title (" + title + ") /Producer (Chike's Creative Space) >>");
  pages.forEach((p, i) => {
    const pg = pageNum(i), contents = pg + 1, img = pg + 2;
    obj(pg, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 " + img + " 0 R >> >> /Contents " + contents + " 0 R >>");
    const draw = enc("q 612 0 0 792 0 0 cm /Im0 Do Q");
    obj(contents, "<< /Length " + draw.length + " >>", draw);
    obj(img, "<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpeg.length + " >>", p.jpeg);
  });
  const count = 4 + n * 3;
  const xrefAt = length;
  let xref = "xref\n0 " + count + "\n0000000000 65535 f \n";
  for (let k = 1; k < count; k++) xref += String(offsets[k]).padStart(10, "0") + " 00000 n \n";
  push(enc(xref + "trailer\n<< /Size " + count + " /Root 1 0 R /Info 3 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF\n"));

  const out = new Uint8Array(length);
  let at = 0;
  for (const u8 of parts) { out.set(u8, at); at += u8.length; }
  return out;
}
