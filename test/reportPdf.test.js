// Export PDF (owner, 2026-11-24: "Instead of print, show export pdf. create a custom pdf design using HTML and convert it
// to a pdf file"). The look is docs/mockups/progress-report-pdf-draft.html. assets/lib/reportPdf.js holds the design and
// the PDF writer; index.html lays the pages out off screen, draws them with html2canvas and downloads the file.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { reportPdfFirstPage, reportPdfBlocks, reportPdfPage, pdfFromJpegs, pdfFileName, REPORT_PDF_CSS } from "../assets/lib/reportPdf.js";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const body = (name) => { const s = index.indexOf("function " + name + "("); return index.slice(s, index.indexOf("\n}\n", s) + 2); };

const model = {
  name: "Maya", grade: "3rd grade", periodLabel: "Week of November 17 to 23, 2026", shortPeriod: "week of November 17", madeOn: "November 24, 2026",
  verdict: "A strong week in math, with science still in practice.", verdictSub: "Maya was active on 5 of the last 7 days and answered 24 questions built into games and books, getting 79% of them right.",
  subjects: [
    { label: "Math", status: "cons", statusLabel: "Consistently demonstrated", n: 9, ownPct: 89, from: ["Robo Math Buddy", "Math Runner"] },
    { label: "Music", status: "none", statusLabel: "Not enough evidence yet", n: 0, ownPct: null, from: [] },
    { label: "Reading and Writing", status: "prac", statusLabel: "Practicing", n: 6, ownPct: 67, from: ["Spelling Detective"] },
  ],
  practice: [{ title: "Spelling “ai” words", text: "2 of 4 right, in Spelling Detective.", tip: "Rain is spelled R-A-I-N." }],
  questions: [{ subject: "Reading and Writing", from: "Spelling Detective", question: "Spell the word that means: water from the sky", gave: "rane", answer: "rain", why: "Rain is spelled R-A-I-N.", hinted: false }],
  days: [{ label: "Monday, November 17", items: [{ title: "Robo Math Buddy", detail: "Game, 5 of 5 right" }] }],
};

describe("the PDF's design", () => {
  it("page 1: the logo, who and which week, the summary, each subject's level, and what the levels mean", () => {
    const p = reportPdfFirstPage(model);
    expect(p).toContain('<img class="rpdf-logo" src="/assets/brand/logo.webp"');
    expect(p).toContain("<h1>Maya</h1>");
    expect(p).toContain("3rd grade");
    expect(p).toContain("Week of November 17 to 23, 2026");
    expect(p).toContain("A strong week in math");
    expect(p).toContain('<span class="rpdf-st rpdf-st--cons"><i>●</i>Consistently demonstrated</span>');
    expect(p).toContain('<span class="rpdf-st rpdf-st--none"><i>○</i>Not enough evidence yet</span>');
    expect(p).toContain("<td>89%</td>");
    expect(p).toContain("Robo Math Buddy, Math Runner");
    expect(p).toContain('<tr class="rpdf-reading">');
    expect(p).toContain("Worth practicing");
    expect(p).toContain("What the levels mean");
  });
  it("then the questions to go over and everything they did, as blocks that the pages fill in order", () => {
    const b = reportPdfBlocks(model);
    expect(b[0]).toContain("Questions to go over");                       /* the heading goes with its first question */
    expect(b[0]).toContain("Spell the word that means: water from the sky");
    expect(b[0]).toContain("Maya answered <b>rane</b>. The answer is <b>rain</b>.");
    expect(b.join("")).toContain("Everything Maya did");
    expect(b.join("")).toContain("Monday, November 17");
    expect(b.join("")).toContain("Game, 5 of 5 right");
    expect(b.at(-1)).toContain("How levels are set.");
  });
  it("a quiet week still makes a clear PDF", () => {
    const quiet = { ...model, practice: [], questions: [], days: [] };
    expect(reportPdfFirstPage(quiet)).not.toContain("Worth practicing");
    expect(reportPdfBlocks(quiet).join("")).toContain("Nothing to go over");
    expect(reportPdfBlocks(quiet).join("")).toContain("Nothing was recorded");
  });
  it("a page: its body, the footer with the site and Page N of M", () => {
    const p = reportPdfPage("<p>x</p>", 2, 3);
    expect(p).toContain('<section class="rpdf-page">');
    expect(p).toContain("Page 2 of 3");
    expect(p).toContain("chikescreativespace.com");
  });
  it("escapes every word that came from a child, a game or a grown-up", () => {
    const bad = { ...model, name: "<img src=x onerror=1>", questions: [{ ...model.questions[0], gave: "<script>" }] };
    const all = reportPdfFirstPage(bad) + reportPdfBlocks(bad).join("");
    expect(all).not.toContain("<img src=x");
    expect(all).not.toContain("<script>");
    expect(all).toContain("&lt;script&gt;");
  });
  it("is US Letter at 96 dpi, in the site's fonts and colours, with no em dashes or he/she", () => {
    expect(REPORT_PDF_CSS).toContain(".rpdf-page{ width:816px; height:1056px;");
    expect(REPORT_PDF_CSS).toContain('"Plus Jakarta Sans"');
    expect(REPORT_PDF_CSS).toContain(".rpdf-st--cons{ --c:#2F6B2C; }");
    const copy = reportPdfFirstPage(model) + reportPdfBlocks(model).join("") + reportPdfPage("", 1, 1);
    expect(copy).not.toContain("—");
    expect(copy.replace(/<[^>]+>/g, " ")).not.toMatch(/\b(he|she|her|hers|his|him)\b/i);
  });
});

describe("the PDF file", () => {
  const jpeg = (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7) & 255);
  const text = (u8) => Array.from(u8, (b) => String.fromCharCode(b)).join("");

  it("is a real PDF: one Letter page per picture, each picture whole, with a working table of where each part is", () => {
    const pages = [{ jpeg: jpeg(300), w: 1632, h: 2112 }, { jpeg: jpeg(120), w: 1632, h: 2112 }];
    const out = pdfFromJpegs(pages, { title: "Maya’s progress report" });
    const s = text(out);
    expect(s.startsWith("%PDF-1.4\n")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/Type /Pages /Kids [");
    expect(s).toContain("/Count 2");
    expect((s.match(/\/MediaBox \[0 0 612 792\]/g) || []).length).toBe(2);
    expect(s).toContain("/Width 1632 /Height 2112 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length 300");
    expect(s).toContain("/Length 120");
    expect(s).toContain("/Title (Maya's progress report)");
    // every object the cross-reference table points at starts exactly there
    const xrefAt = s.lastIndexOf("\nxref\n") + 1, xref = s.slice(xrefAt);   /* the table, not the "startxref" line after it */
    const count = Number(xref.match(/^xref\n0 (\d+)/)[1]);
    const offsets = xref.split("\n").slice(3, 2 + count).map((l) => Number(l.slice(0, 10)));
    offsets.forEach((off, i) => expect(s.slice(off, off + String(i + 1).length + 6)).toBe((i + 1) + " 0 obj"));
    expect(Number(s.match(/startxref\n(\d+)/)[1])).toBe(xrefAt);
    // the pictures' bytes go in untouched
    const at = s.indexOf("stream\n", s.indexOf("/Length 300")) + 7;
    expect(Array.from(out.slice(at, at + 300))).toEqual(Array.from(pages[0].jpeg));
  });
  it("keeps the title to plain characters, so any PDF reader shows it", () => {
    const s = text(pdfFromJpegs([{ jpeg: jpeg(10), w: 10, h: 10 }], { title: "Zoë (2nd) \\ report" }));
    expect(s).toContain("/Title (Zo? \\(2nd\\) \\\\ report)");
  });
  it("is named for the child and the week", () => {
    expect(pdfFileName("Maya", "2026-11-17")).toBe("Maya-progress-report-2026-11-17.pdf");
    expect(pdfFileName("Mary-Kate O'Neil", "2026-11-17")).toBe("Mary-Kate-ONeil-progress-report-2026-11-17.pdf");
    expect(pdfFileName("<>", "")).toBe("progress-report.pdf");
  });
});

describe("on the site", () => {
  it("the report's Print button is now Export PDF", () => {
    const r = body("progressReportHTML");
    expect(r).toContain('<button type="button" class="rp-btn" data-act="progress-export">\' + ic("file-down") + \'Export PDF</button>');
    expect(r).not.toContain("progress-print");
    expect(index).toContain('"progress-export": (el) => progressExportPdf(el),');
  });
  it("loads html2canvas only when a PDF is made, from the site itself", () => {
    expect(existsSync(new URL("../assets/vendor/html2canvas.min.js", import.meta.url))).toBe(true);
    expect(index).not.toMatch(/<script[^>]+html2canvas/);
    expect(body("progressExportPdf")).toContain('await progressLoadScript("assets/vendor/html2canvas.min.js");');
    expect(index).toContain('import * as ReportPdf from "./assets/lib/reportPdf.js";');
  });
  it("lays the pages out off screen, fills each one in order, then draws, joins and downloads them", () => {
    const x = body("progressExportPdf");
    expect(x).toContain("progressPdfModel()");
    expect(x).toContain("reportPdfFirstPage(model)");
    expect(x).toContain("reportPdfBlocks(model)");
    expect(x).toContain("html2canvas(");
    expect(x).toContain('canvas.toBlob(resolve, "image/jpeg", 0.92)');
    expect(x).toContain("pdfFromJpegs(");
    expect(x).toContain("pdfFileName(");
    expect(x).toContain("host.remove()");
    expect(x).toContain("The PDF couldn’t be made just now");
  });
});
