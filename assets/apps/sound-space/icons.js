(function (root) {
  const SS = (root.SoundSpace = root.SoundSpace || {});

  // Hand-drawn instrument pictures: a 48 x 48 box, 2.5 px round strokes, two tones of the category's color (a deep
  // shade for the lines, the color itself for the fills). In a body, fill="F" is the color and fill="D" the shade.
  // Plain shapes only: no scripts, no links, no text.

  function shade(hex, f) {
    return "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  // ---- small parts used by several pictures --------------------------------------------------------------------
  const r = (x, y, w, h, fill, rx) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx === undefined ? 1.5 : rx) + '"' + (fill ? ' fill="' + fill + '"' : "") + "/>";
  const c = (x, y, rr, fill) => '<circle cx="' + x + '" cy="' + y + '" r="' + rr + '"' + (fill ? ' fill="' + fill + '"' : "") + "/>";
  const e = (x, y, rx, ry, fill, rot) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '"' + (fill ? ' fill="' + fill + '"' : "") + (rot ? ' transform="rotate(' + rot + " " + x + " " + y + ')"' : "") + "/>";
  const p = (d, fill) => '<path d="' + d + '"' + (fill ? ' fill="' + fill + '"' : "") + "/>";
  const g = (tx, ty, body) => '<g transform="translate(' + tx + " " + ty + ')">' + body + "</g>";

  // a keyboard: white keys with lines between, black keys filled with the shade
  function kb(x, y, w, h, n) {
    const kw = w / n;
    let s = r(x, y, w, h, "F", 1.5);
    for (let i = 1; i < n; i++) s += p("M" + (x + i * kw).toFixed(1) + " " + (y + h * 0.55).toFixed(1) + "V" + (y + h));
    for (let i = 0; i < n - 1; i++) {
      if ([0, 1, 3, 4, 5].indexOf(i % 7) < 0) continue;
      s += r((x + (i + 1) * kw - kw * 0.3).toFixed(1), y, (kw * 0.6).toFixed(1), (h * 0.55).toFixed(1), "D", 0.6);
    }
    return s;
  }
  // waves across a box: x, middle y, width, height (half the swing), teeth
  function wave(kind, x, y, w, a, n) {
    const k = n || 3, step = w / k;
    let d = "";
    if (kind === "saw") {
      d = "M" + x + " " + (y + a);
      for (let i = 0; i < k; i++) d += "L" + (x + (i + 1) * step).toFixed(1) + " " + (y - a) + "V" + (y + a);
    } else if (kind === "square") {
      d = "M" + x + " " + (y + a);
      for (let i = 0; i < k; i++) {
        const x0 = x + i * step;
        d += "V" + (y - a) + "H" + (x0 + step / 2).toFixed(1) + "V" + (y + a) + "H" + (x0 + step).toFixed(1);
      }
    } else if (kind === "tri") {
      d = "M" + x + " " + y;
      for (let i = 0; i < k; i++) d += "L" + (x + i * step + step / 4).toFixed(1) + " " + (y - a) + "L" + (x + i * step + (3 * step) / 4).toFixed(1) + " " + (y + a) + "L" + (x + (i + 1) * step).toFixed(1) + " " + y;
    } else {
      d = "M" + x + " " + y;
      for (let i = 0; i < k; i++) {
        const x0 = x + i * step, h = step / 2;
        d += "C" + (x0 + h * 0.36).toFixed(1) + " " + (y - a * 1.3) + " " + (x0 + h * 0.64).toFixed(1) + " " + (y - a * 1.3) + " " + (x0 + h).toFixed(1) + " " + y;
        d += "S" + (x0 + h + h * 0.64).toFixed(1) + " " + (y + a * 1.3) + " " + (x0 + step).toFixed(1) + " " + y;
      }
    }
    return p(d);
  }
  // a bass clef badge in a round chip, its top left at x, y (14 x 14)
  // the bass versions' mark: a big bass clef (about 24 x 26), its top left at x, y; it reads as "bass" at tile size
  const bigClef = (x, y) => "<!--big clef-->" + p("M" + (x + 1.5) + " " + (y + 8) + "a8 8 0 1 1 16 1.5c0 9-7 15-16 18") + c(x + 4, y + 8, 3.4, "D") + c(x + 21.5, y + 5, 2.3, "D") + c(x + 21.5, y + 14, 2.3, "D");
  // a five-point star as a polygon
  function starPoly(cx, cy, R, rr, fill) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? rr : R;
      pts.push((cx + d * Math.cos(a)).toFixed(1) + "," + (cy + d * Math.sin(a)).toFixed(1));
    }
    return '<polygon points="' + pts.join(" ") + '" fill="' + fill + '"/>';
  }
  const clef = (x, y) => c(x + 7, y + 7, 8, "F") + p("M" + (x + 2.5) + " " + (y + 5.5) + "a4 4 0 1 1 6.5 3c0 3-3 5-6.5 6.5") + c(x + 2.8, y + 5.6, 1.4, "D") + c(x + 12.2, y + 4.2, 0.9, "D") + c(x + 12.2, y + 8.6, 0.9, "D");
  // a four-point sparkle
  const star = (x, y, s, fill) => p("M" + x + " " + (y - s) + "Q" + x + " " + y + " " + (x + s) + " " + y + "Q" + x + " " + y + " " + x + " " + (y + s) + "Q" + x + " " + y + " " + (x - s) + " " + y + "Q" + x + " " + y + " " + x + " " + (y - s) + "Z", fill || "F");
  // an eighth note
  const note = (x, y) => e(x, y, 3.4, 2.6, "D", -20) + p("M" + (x + 3) + " " + (y - 1) + "V" + (y - 12) + "c2 3 5 4 5 8");
  // pixel art: rows of "#" (color) and "+" (shade), each cell s wide, starting at x, y
  function pix(x, y, s, rows) {
    let out = "";
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === "#" || ch === "+") out += '<rect x="' + (x + i * s) + '" y="' + (y + j * s) + '" width="' + s + '" height="' + s + '" fill="' + (ch === "#" ? "F" : "D") + '" stroke="none"/>';
      }
    });
    return out;
  }
  // a mallet or stick with a round head
  const mallet = (x1, y1, x2, y2, rr) => p("M" + x1 + " " + y1 + "L" + x2 + " " + y2) + c(x2, y2, rr || 2.8, "D");
  // a violin-family body (about 20 x 26) with its middle at x, y; big makes it cello or bass sized
  function fiddle(x, y, big) {
    const k = big ? 1.35 : 1;
    const q = (v) => (v * k).toFixed(1);
    return p("M" + x + " " + (y - 13 * k).toFixed(1) + "c" + q(-5) + " 0 " + q(-8) + " " + q(3) + " " + q(-7) + " " + q(7) + "c" + q(1) + " " + q(3) + " " + q(-3) + " " + q(4) + " " + q(-3) + " " + q(8) + "c0 " + q(6) + " " + q(5) + " " + q(9) + " " + q(10) + " " + q(9) + "s" + q(10) + " " + q(-3) + " " + q(10) + " " + q(-9) + "c0 " + q(-4) + " " + q(-4) + " " + q(-5) + " " + q(-3) + " " + q(-8) + "c" + q(1) + " " + q(-4) + " " + q(-2) + " " + q(-7) + " " + q(-7) + " " + q(-7) + "z", "F")
      + p("M" + x + " " + (y - 12 * k).toFixed(1) + "V" + (y + 9 * k).toFixed(1) + "M" + (x - 3 * k).toFixed(1) + " " + (y + 4 * k).toFixed(1) + "h" + q(6))
      + p("M" + (x - 5 * k).toFixed(1) + " " + (y - 1 * k).toFixed(1) + "c" + q(-1.4) + " " + q(2) + " " + q(1.4) + " " + q(3.4) + " 0 " + q(5.6)
        + "M" + (x + 5 * k).toFixed(1) + " " + (y - 1 * k).toFixed(1) + "c" + q(1.4) + " " + q(2) + " " + q(-1.4) + " " + q(3.4) + " 0 " + q(5.6));
  }
  const drumBody = (x, y, w, h) => e(x + w / 2, y, w / 2, 3.5, "F") + p("M" + x + " " + y + "v" + h + "c0 2.4 " + (w * 0.22).toFixed(1) + " 4 " + (w / 2) + " 4s" + (w / 2) + "-1.6 " + (w / 2) + "-4V" + y);
  const tuba = (x, y) => g(x, y, p("M2 3h26l-6 9H8z", "F") + p("M9 12h12v18a6 6 0 0 1-12 0z", "F") + r(22, 15, 7, 2.6, "D", 1) + r(22, 19.5, 7, 2.6, "D", 1) + r(22, 24, 7, 2.6, "D", 1) + p("M29 16v-5h3"));
  const bassoon = (x, y) => g(x, y, r(10, 6, 7, 34, "F", 2) + p("M13.5 6c0-3 4-4 7-2M17 32h3v8h-3") + c(13.5, 16, 1.2, "D") + c(13.5, 22, 1.2, "D") + c(13.5, 28, 1.2, "D"));
  const timp = (x, y) => g(x, y, p("M4 12h32c0 10-7 17-16 17S4 22 4 12z", "F") + e(20, 12, 16, 3.5) + p("M10 27l-3 9M30 27l3 9M20 29v7"));
  const bars = (x, y, n, w0, dw, h0, dh, gap) => {
    let s = "";
    for (let i = 0; i < n; i++) s += r(x + i * (w0 + gap), y + i * (dh / 2), w0, h0 - i * dh, "F", 1.2);
    return s;
  };

  // ---- the pictures ------------------------------------------------------------------------------------------
  const B = {
    // Drums and percussion
    "classic-kit": p("M29 8h15M36.5 8v12") + r(3, 18, 13, 8, "F", 2) + p("M9.5 26v13M6 39h7") + c(27, 31, 11, "F") + c(27, 31, 4.5),
    "orchestra-kit": c(21, 23, 14, "F") + c(21, 23, 9) + p("M11 40l4-6M31 40l-4-6M9 40h24") + mallet(44, 4, 37, 15, 3),
    "marching-drums": p("M11 21C11 6 37 6 37 21") + drumBody(10, 24, 28, 12) + p("M14 30l4 6 4-6 4 6 4-6 4 6") + p("M4 6l15 15M44 6L29 21"),
    "hand-drums": p("M6 10c4-2 9-2 13 0 2 9 2 18-1 30H7C4 28 4 19 6 10z", "F") + e(12.5, 10, 6.5, 2) + p("M26 6c5-2 11-2 16 0 2 11 2 22-1 35H27c-3-13-3-24-1-35z", "F") + e(34, 6, 8, 2.2) + p("M8 26h9M28 25h12"),
    "cajon": r(11, 5, 26, 38, "F", 2) + p("M11 11h26") + c(24, 30, 5.5, "D") + p("M15 5v6M33 5v6"),
    "latin-percussion": p("M13 14h14l7 26H6z", "F") + p("M17 14V7h6v7M9 34h22") + mallet(34, 10, 43, 4, 2.5),
    "tambourines-and-shakers": c(19, 24, 13, "F") + c(19, 24, 7.5) + r(17.2, 8, 3.6, 4, "D", 0.8) + r(17.2, 36, 3.6, 4, "D", 0.8) + r(3, 22.2, 4, 3.6, "D", 0.8) + r(31, 22.2, 4, 3.6, "D", 0.8) + e(39, 35, 5, 7.5, "F", 25) + p("M42 13l3-3M44 20h3"),
    "woodblocks-and-claps": r(4, 22, 28, 15, "F", 5) + p("M9 29.5h18") + mallet(42, 6, 33, 15, 3) + p("M38 26l6-3M39 32h6M38 38l6 3"),
    "timpani": timp(4, 6),
    "gongs-and-cymbals": p("M6 43V7h36v36M3 43h6M39 43h6M17 7l3 8M31 7l-3 8") + c(24, 26, 11, "F") + c(24, 26, 4, "D"),
    "hand-chimes": p("M24 3v9M19 4h10") + p("M13 34c0-11 4-21 11-21s11 10 11 21z", "F") + p("M9 34h30") + c(24, 39, 2.8, "D"),
    "frame-drum": c(21, 25, 17, "F") + p("M38 25c0 9.4-7.6 17-17 17") + c(21, 25, 11) + c(21, 14, 1.3, "D") + c(32, 25, 1.3, "D") + c(21, 36, 1.3, "D") + c(10, 25, 1.3, "D") + mallet(46, 3, 38, 11, 2.6),
    "drum-machine": r(3, 11, 42, 27, "F", 3) + c(11, 19, 3) + c(20, 19, 3) + r(28, 15, 13, 7, "D", 1.5) + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => r(6.5 + i * 4.6, 28, 3.2, 5, "D", 0.8)).join(""),
    "electronic-kit": p("M24 4l8 4.6v9.2L24 22.4l-8-4.6V8.6z", "F") + p("M11 22l6 3.5v7L11 36l-6-3.5v-7z", "F") + p("M37 22l6 3.5v7L37 36l-6-3.5v-7z", "F") + p("M24 22.4V44M11 36v8M37 36v8"),
    "hip-hop-kit": r(8, 4, 32, 40, "F", 3) + r(12, 8, 24, 8, "D", 1.5) + [0, 1, 2].map((i) => [0, 1, 2].map((j) => r(12 + i * 8.6, 20 + j * 7.6, 6.2, 5.6, null, 1.2)).join("")).join(""),
    "lo-fi-kit": r(3, 10, 42, 28, "F", 3) + r(10, 15, 28, 11, null, 2) + c(17, 20.5, 3.2, "D") + c(31, 20.5, 3.2, "D") + p("M12 38l3-6h18l3 6"),
    "trap-kit": e(24, 13, 17, 3.5, "F") + e(24, 20, 17, 3.5, "F") + p("M24 23.5V43M15 43h18") + c(6, 32, 1.4, "D") + c(11, 32, 1.4, "D") + c(16, 32, 1.4, "D"),
    "dance-kit": c(24, 25, 11, "F") + c(24, 25, 5) + c(24, 25, 1.8, "D") + p("M24 5v4M24 41v4M4 25h4M40 25h4M10 11l3 3M38 11l-3 3M10 39l3-3M38 39l-3-3"),
    "chip-tune-drums": pix(6, 10, 3, ["..+++++++++..", ".###########.", "#+#+#+#+#+#+#", "#############", "#+#+#+#+#+#+#", "#############", ".###########.", "..+++++++++.."]) + p("M10 4l6 6M38 4l-6 6"),
    "toy-kit": drumBody(9, 20, 30, 14) + p("M9 24l5 10 5-10 5 10 5-10 5 10 5-10", null) + p("M17 17L8 5M31 17l9-12") + c(8, 5, 2.6, "D") + c(40, 5, 2.6, "D"),

    // Keys and mallets
    // seen from the side, its lid propped up (the harpsichord is seen from above, with two keyboards)
    "grand-piano": "<!--lid-->" + p("M4 20L36 5l3 4L10 20z", "F") + p("M30 9l-1 11") + r(3, 20, 42, 9, "F", 2) + p("M10 20v9") + p("M7 29v13M41 29v13M24 29v10M20 39h8") + c(7, 43, 1.6, "D") + c(41, 43, 1.6, "D"),
    "upright-piano": r(6, 5, 36, 22, "F", 2) + r(10, 9, 28, 8, null, 1) + kb(4, 27, 40, 8, 10) + p("M8 35v8M40 35v8"),
    "harpsichord": p("M5 7h14l24 21v6H5z", "F") + kb(5, 29, 26, 5, 7) + kb(5, 35, 26, 5, 7) + p("M9 40v4M27 40v4M41 34v10"),
    "pipe-organ": r(4, 34, 40, 10, "F", 1.5) + [[6, 20], [12, 12], [18, 6], [24, 4], [30, 6], [36, 12], [42, 20]].map((q) => r(q[0] - 2.2, q[1], 4.4, 34 - q[1], "F", 2)).join("") + p("M8 39h32"),
    "marimba": bars(4, 6, 6, 5.2, 0, 16, 2, 2) + [6.6, 13.8, 21, 28.2, 35.4, 42.6].map((x, i) => p("M" + x + " " + (22 - i) + "V" + (44 - i * 3))).join(""),
    "xylophone": p("M4 20l40 4M4 38l40-4") + [0, 1, 2, 3, 4, 5].map((i) => r(6 + i * 6.4, 16 + i * 1.6, 4.6, 26 - i * 3.6, "F", 1)).join("") + mallet(14, 13, 22, 3, 2.4) + mallet(36, 13, 28, 3, 2.4),
    "vibraphone": [0, 1, 2, 3, 4].map((i) => r(5 + i * 8, 6 + i * 1.5, 6, 18 - i * 3, "F", 1.2)).join("") + [0, 1, 2, 3, 4].map((i) => c(8 + i * 8, 30, 2.6)).join("") + p("M4 26h40M8 33v8M40 33v8M18 44h12"),
    "glockenspiel": r(4, 8, 40, 32, "F", 3) + [0, 1, 2, 3, 4, 5, 6].map((i) => r(8 + i * 5, 14 + i, 3.4, 20 - 2 * i, null, 0.8)).join("") + mallet(40, 44, 31, 30, 2.4),
    "kalimba": p("M10 6h28l4 34a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z", "F") + p("M8 14h32") + [[14, 26], [18, 30], [22, 33], [26, 33], [30, 30], [34, 26]].map((q) => p("M" + q[0] + " 10V" + q[1])).join("") + c(24, 38, 2.6, "D"),
    "tubular-bells": p("M4 6h40M8 6v38M40 6v38") + r(13, 9, 4.4, 30, "F", 2) + r(20, 9, 4.4, 26, "F", 2) + r(27, 9, 4.4, 22, "F", 2) + r(34, 9, 2.6, 18, "D", 1) + mallet(18, 44, 30, 38, 2.4),
    "electric-piano": kb(3, 12, 42, 12, 10) + p("M14 24l20 19M34 24L14 43"),
    "rock-organ": r(5, 6, 38, 34, "F", 2) + kb(8, 18, 32, 7, 8) + kb(8, 28, 32, 7, 8) + [12, 16, 20, 24, 28].map((x, i) => p("M" + x + " 9v" + (2 + (i % 3) * 2))).join("") + p("M10 40v4M38 40v4"),
    "music-box": p("M5 20l5-12h30l-5 12", null) + r(5, 20, 30, 18, "F", 2) + p("M35 29h7v-7") + c(42, 20, 2.2, "D") + note(17, 32),
    "toy-piano": p("M10 10h28a4 4 0 0 1 4 4v14H6V14a4 4 0 0 1 4-4z", "F") + kb(6, 28, 36, 8, 7) + p("M10 36v7M38 36v7") + star(24, 19, 4, "D"),
    "steel-drum": p("M7 20v10c0 4 7.6 8 17 8s17-4 17-8V20") + e(24, 20, 17, 8, "F") + e(17, 19, 4, 2.6) + e(30, 18, 4.4, 2.8) + e(24, 23.5, 3, 1.8),
    "bell": p("M21 7a3 3 0 0 1 6 0") + p("M24 9c-8 0-11 8-11 15 0 7-4 9-7 12h36c-3-3-7-5-7-12 0-7-3-15-11-15z", "F") + c(24, 40, 3, "D"),
    "twinkle-keys": kb(4, 26, 40, 14, 9) + star(15, 13, 6) + star(32, 9, 4) + star(38, 19, 3),
    "synth-lead": kb(4, 28, 40, 13, 9) + wave("saw", 6, 13, 36, 6, 3),
    "synth-pad": kb(4, 28, 40, 13, 9) + p("M6 20c4-8 8-8 12 0s8 8 12 0 8-8 12 0", null) + p("M6 13c6-6 10-6 18 0s12 6 18 0"),
    "chip-tune": r(13, 13, 22, 22, "F", 2) + r(19, 19, 10, 10, "D", 1) + [17, 24, 31].map((v) => p("M" + v + " 6v7M" + v + " 35v7M6 " + v + "h7M35 " + v + "h7")).join(""),

    // Strings
    "violin": fiddle(18, 30) + p("M18 17V5") + c(18, 4.5, 2.2, "D") + p("M33 4l9 40"),
    "viola-section": g(-6, 0, fiddle(18, 30) + p("M18 17V5") + c(18, 4.5, 2, "D")) + g(10, 2, fiddle(18, 30) + p("M18 17V5") + c(18, 4.5, 2, "D")) + p("M3 44L44 10"),
    "bowed-psaltery": p("M22 4L38 42H6z", "F") + p("M16 20v22M22 10v32M28 20v22") + p("M30 6l14 30"),
    "violin-section": g(-8, 2, fiddle(18, 30) + p("M18 17V6")) + g(6, -4, fiddle(18, 30) + p("M18 17V6")) + g(20, 4, fiddle(18, 30) + p("M18 17V8")),
    "cello-section": g(-9, 4, fiddle(22, 26, true) + p("M22 8V3M22 44v-1")) + g(5, 2, fiddle(22, 26, true) + p("M22 8V2M22 43.5v1.5")),
    "concert-harp": p("M9 7v36M6 43h18") + p("M9 7c8-3 14 3 22 0 4-1 7 0 8 3", null) + p("M39 10L18 43h-6", "F") + [15, 21, 27, 33].map((x, i) => p("M" + x + " " + (8 + (i % 2)) + "V" + (36 - i * 5))).join(""),
    "folk-harp": p("M12 12v30") + p("M12 12c6-6 14 0 22-2", null) + p("M34 10L16 42h-6l4-6", "F") + [18, 24, 30].map((x, i) => p("M" + x + " 12V" + (32 - i * 6))).join("") + c(12, 12, 2.2, "D"),
    "psaltery": p("M5 12h38l-9 26H14z", "F") + [17, 21, 25, 29].map((y) => p("M" + (8 + (y - 12) * 0.3).toFixed(1) + " " + y + "H" + (40 - (y - 12) * 0.3).toFixed(1))).join("") + c(24, 32, 2.6, "D"),
    "dan-tranh": p("M3 37L38 6l6 5L9 42z", "F") + [[14, 30], [20, 25], [26, 20], [32, 15]].map((q) => p("M" + q[0] + " " + q[1] + "l3 4h-6z", "D")).join("") + p("M6 39L41 8"),
    "strumstick": p("M24 26c-7 0-10 5-10 9.5S18 43 24 43s10-3.5 10-7.5S31 26 24 26z", "F") + p("M24 26V4M21 9h6M21 14h6M21 19h6") + c(21, 35, 1.4, "D") + c(27, 35, 1.4, "D"),
    "plucked-strings": p("M10 40c-6-6-4-16 4-22s18-6 20 2-6 18-12 22-10 2-12-2z", "F") + c(20, 30, 3.5) + p("M30 18l10-11 4 4") + p("M14 36l16-16"),
    "nylon-pluck": p("M15 20c-5 0-8 3.5-7 7.5-3 2-4 5-3 8 1 4.5 5.5 6.5 10.5 6.5s9.5-2 10.5-6.5c1-3 0-6-3-8 1-4-2-7.5-8-7.5z", "F") + c(15.5, 32, 3.2, "D") + p("M21 22L40 5M37 3l6 5"),
    "bright-pluck": p("M8 8h20a3 3 0 0 1 2.6 4.5l-10 17a3 3 0 0 1-5.2 0l-10-17A3 3 0 0 1 8 8z", "F") + p("M4 38h40M4 43h40") + star(38, 17, 6, "D"),
    "twelve-string-shimmer": p("M18 4h12l2 22H16z", "F") + p("M24 26v18") + [7, 11.5, 16, 20.5].map((y) => c(13, y, 1.6, "D") + c(35, y, 1.6, "D")).join("") + star(40, 38, 5) + star(9, 37, 3),
    "banjo-style-pluck": c(17, 31, 12, "F") + c(17, 31, 7.5) + p("M26 23L42 6M39 4l5 5") + c(29, 20, 1.6, "D"),
    "koto-style-pluck": p("M3 24c14-7 28-7 42 0v7H3z", "F") + [9, 16, 23, 30, 37].map((x) => p("M" + (x - 2) + " 31l2-6 2 6", null)).join("") + p("M4 27.5h40"),
    "synth-strings": g(-4, 2, fiddle(18, 28) + p("M18 15V4")) + wave("saw", 26, 30, 18, 4, 2) + wave("sine", 26, 16, 18, 3, 2),
    "glass-strings": p("M13 5h22c0 10-4.5 17-11 17S13 15 13 5z", "F") + p("M24 22v14M16 42c0-4 4-6 8-6s8 2 8 6z") + p("M40 10c3 3 3 9 0 12M7 10c-3 3-3 9 0 12"),
    "space-strings": c(26, 22, 10, "F") + e(26, 22, 18, 5, null, -20) + p("M4 46L16 34M8 46L20 34") + star(9, 9, 4, "D"),
    "pizzicato-pluck": p("M10 4v40M18 4v40M34 4v40") + p("M26 4c0 12 4 16 4 20s-4 8-4 20") + c(31, 24, 4, "F") + note(41, 42),

    // Brass and winds
    "trumpet": p("M4 21h26M10 21v8h20v-8") + p("M30 17l13-8v26l-13-8z", "F") + r(13, 12, 3, 9, "D", 1) + r(18, 12, 3, 9, "D", 1) + r(23, 12, 3, 9, "D", 1) + p("M2 19v4"),
    "french-horn": c(19, 24, 12) + c(19, 24, 6) + p("M27 32l9 8 7-10-9-5z", "F") + p("M7 24H3"),
    "trombone": p("M14 15h28v8H14M14 31h22") + p("M14 13L3 7v32l11-6z", "F") + p("M36 23v8") + r(22, 23, 4, 8, "D", 1),
    "tuba": tuba(9, 4) + p("M15 38h18"),
    "flute": p("M3 36l38-28 4 5-38 28z", "F") + [0, 1, 2, 3, 4].map((i) => c(14 + i * 5.5, 30.5 - i * 4, 1.3, "D")).join("") + e(37, 14, 1.8, 1.2, "D"),
    "piccolo": p("M12 31l22-17 3 4-22 17z", "F") + [0, 1, 2].map((i) => c(19 + i * 5, 26 - i * 3.8, 1.2, "D")).join("") + star(40, 34, 4),
    "clarinet": p("M21 4h6v28l5 10H16l5-10z", "F") + p("M21 9h6") + [15, 20, 25, 30].map((y) => c(24, y, 1.3, "D")).join(""),
    "oboe": p("M10 9l26 26 3 7-7-3L6 13z", "F") + p("M8 11L3 6M6 3l5 5") + [0, 1, 2, 3].map((i) => c(15 + i * 5, 18 + i * 5, 1.2, "D")).join(""),
    "bassoon": bassoon(6, 2) + p("M27 4c4 2 6 6 6 12"),
    "tenor-saxophone": p("M12 4h8c3 0 4 2 4 4v22c0 4 2 6 5 6s5-2 5-6v-6h6v6c0 7-5 12-11 12s-11-5-11-12V10h-6z", "F") + c(20, 16, 1.4, "D") + c(20, 22, 1.4, "D") + c(20, 28, 1.4, "D"),
    "recorder": p("M20 4h8l-1 6v26l3 8H18l3-8V10z", "F") + r(22, 12, 4, 3, "D", 0.6) + [19, 24, 29, 34].map((y) => c(24, y, 1.3, "D")).join(""),
    "harmonica": r(4, 15, 40, 18, "F", 3) + p("M4 21h40") + [0, 1, 2, 3, 4, 5, 6].map((i) => r(7.5 + i * 5, 24.5, 3, 4, "D", 0.6)).join(""),
    "ocarina": p("M8 26c0-9 9-15 20-15 9 0 16 6 16 13s-8 13-19 13C14 37 8 33 8 26z", "F") + p("M8 24L3 22v8l5-2") + [[20, 19], [27, 18], [34, 20], [24, 30], [32, 29]].map((q) => c(q[0], q[1], 1.6, "D")).join(""),
    "didgeridoo": p("M3 13l38 18v7L3 19z", "F") + [9, 16, 23, 30].map((x) => c(x, 17.4 + (x - 3) * 0.47, 1.2, "D")).join("") + p("M44 28v12"),
    "synth-brass": p("M4 30h16") + p("M20 26l12-7v22l-12-7z", "F") + r(10, 22, 3, 8, "D", 1) + wave("saw", 6, 9, 36, 4, 3),
    "soft-synth-flute": p("M3 33h40v6H3z", "F") + [12, 18, 24, 30].map((x) => c(x, 36, 1.2, "D")).join("") + wave("sine", 6, 16, 36, 4, 2),
    "whistle-lead": p("M6 17h20a11 11 0 1 1-11 13H6z", "F") + c(26, 28, 3.5, "D") + p("M6 17v13") + c(38, 9, 4) + p("M34 12l-4 5"),
    "pan-pipe-style": [0, 1, 2, 3, 4, 5].map((i) => r(5 + i * 6.5, 6, 5.2, 34 - i * 4.5, "F", 2)).join("") + p("M4 16h40") + c(7.6, 9.5, 1.1, "D") + c(14.1, 9.5, 1.1, "D"),
    "reed-buzz": p("M8 18h16l8 6-8 6H8z", "F") + p("M10 24h12") + p("M34 14l4 4-4 4 4 4-4 4 4 4"),
    "chip-tune-horn": pix(4, 12, 3, ["...........++", "..........+##", "+++++++++####", "#############", "+++++++++####", "..........+##", "...........++"]) + r(13, 30, 4, 6, "D", 0.5) + r(19, 30, 4, 6, "D", 0.5),

    // Bass
    "double-bass": fiddle(17, 28, true) + p("M17 10V3M17 45.5v-1") + c(17, 3, 1.8, "D") + p("M33 6l8 36"),
    "plucked-double-bass": fiddle(17, 28, true) + p("M17 10V3M17 45.5v-1") + c(17, 3, 1.8, "D") + p("M34 22c3 2 3 6 0 8M39 19c5 4 5 10 0 14"),
    "tuba-bass": bigClef(2, 3) + p("M25 20h20l-4 7H29z", "F") + p("M30 27h10v11a5 5 0 0 1-10 0z", "F") + r(41, 29, 4.5, 2.2, "D", 1) + r(41, 33, 4.5, 2.2, "D", 1),
    "bassoon-bass": bigClef(2, 3) + r(32, 8, 7, 36, "F", 2) + p("M35.5 8c0-3 4-4 7-2M39 36h3v8h-3") + c(35.5, 18, 1.2, "D") + c(35.5, 24, 1.2, "D") + c(35.5, 30, 1.2, "D"),
    "low-marimba": bigClef(2, 2) + [0, 1, 2, 3, 4].map((i) => r(4 + i * 8.4, 31, 6.6, 7, "F", 1.2) + p("M" + (7.3 + i * 8.4).toFixed(1) + " 38V" + (46 - i))).join("") + mallet(44, 6, 34, 22, 3),
    "timpani-bass": bigClef(2, 2) + p("M16 28h28c0 8-6 12-14 12S16 36 16 28z", "F") + e(30, 28, 14, 3) + p("M21 39l-2 6M39 39l2 6") + mallet(44, 4, 36, 18, 2.6),
    "soft-bass": p("M3 34c7-14 14-14 21 0s14 14 21 0V44H3z", "F") + p("M3 22c7-8 14-8 21 0s14 8 21 0"),
    "synth-bass": r(4, 22, 40, 20, "F", 3) + c(12, 30, 3.4) + c(22, 30, 3.4) + r(30, 27, 10, 8, "D", 1.5) + wave("saw", 8, 11, 32, 5, 3),
    "sub-bass": r(5, 4, 38, 40, "F", 3) + c(24, 26, 12) + c(24, 26, 5, "D") + c(24, 10, 2.4),
    "wobble-bass": p("M3 24c3-2 4-2 6 0s3 3 5 0 4-12 7-12 4 24 7 24 4-12 7-12 3 3 5 0 3-2 5 0") + p("M3 40h42M3 8h42") + r(19, 33, 10, 5, "F", 1.5),
    "square-bass": p("M3 38V20h10v18h10V20h10v18h10V20h2v24H3z", "F") + p("M3 12h42"),
    "plucked-synth-bass": p("M17 3h14l2 18H15z", "F") + c(13, 8, 1.6, "D") + c(13, 14, 1.6, "D") + c(35, 8, 1.6, "D") + c(35, 14, 1.6, "D") + p("M24 21v6") + wave("tri", 4, 37, 40, 5, 3),
    // a star-shaped body (the electric-style bass has the usual long body)
    "funky-bass": p("M16 28L36 7l3 3L19 31z", "F") + p("M35 5l5-2 4 4-2 5z", "F") + starPoly(14, 33, 12, 5.2, "F") + c(14, 33, 2.4, "D") + p("M33 30l7-2M35 37h7"),
    "rubber-bass": p("M8 24c0-8 6-12 16-12s16 4 16 12-6 12-16 12S8 32 8 24z", "F") + p("M14 24c0-4 4-6 10-6s10 2 10 6-4 6-10 6-10-2-10-6z") + p("M4 42c2-2 4-2 6 0M38 42c2-2 4-2 6 0"),
    "deep-pad-bass": p("M3 22c7-6 14-6 21 0s14 6 21 0") + p("M3 30c7-6 14-6 21 0s14 6 21 0V44H3z", "F") + p("M3 38c7-6 14-6 21 0s14 6 21 0"),
    "chip-tune-bass": pix(3, 15, 3, ["+++++.....+++++", "#...#.....#...#", "#...#.....#...#", "#...#.....#...#", "#...#######...#", "###############"]) + p("M5 10h38"),
    "electric-style-bass": p("M14 44c-6-2-8-9-4-13 1-2 0-4 3-6 2-2 5-1 7 0L37 6l3 3-17 19c1 2 2 5 0 8-2 4-5 9-9 8z", "F") + p("M37 6l4-3 4 4-3 4") + c(16, 34, 2, "D") + p("M18 31l4 4"),
    "picked-synth-bass": p("M6 6h14a2.5 2.5 0 0 1 2 3.8l-7 12a2.5 2.5 0 0 1-4.2 0l-7-12A2.5 2.5 0 0 1 6 6z", "F") + wave("square", 4, 36, 40, 5, 3),
    "boom-bass": r(4, 10, 22, 28, "F", 3) + c(15, 24, 7) + c(15, 24, 2.6, "D") + p("M31 16c3 2 3 14 0 16M36 12c5 4 5 20 0 24M41 8c7 6 7 26 0 32"),
    "hum-bass": wave("sine", 4, 14, 40, 3, 4) + wave("sine", 4, 24, 40, 3, 4) + p("M4 34c3.3-4 6.7-4 10 0s6.7 4 10 0 6.7-4 10 0 6.7 4 10 0V44H4z", "F"),

    // Sound effects
    "siren": p("M12 32c0-9 5-15 12-15s12 6 12 15z", "F") + r(8, 32, 32, 8, "D", 2) + p("M24 4v6M8 10l4 4M40 10l-4 4M3 24h5M40 24h5"),
    "train-whistle": r(19, 18, 10, 24, "F", 2) + p("M16 42h16M24 18v-4") + r(21, 22, 6, 4, "D", 1) + c(16, 9, 4) + c(25, 6, 3.5) + c(33, 10, 3),
    "ratchet": c(16, 18, 10, "F") + p("M16 4v4M26 9l-3 3M30 18h-4M26 27l-3-3M6 9l3 3M2 18h4") + c(16, 18, 3, "D") + p("M22 26l14 16"),
    "slapstick": p("M6 40L40 30l2 5L8 45z", "F") + p("M6 40L36 10l4 3L10 43z", "F") + p("M42 18c2 2 3 4 3 7M38 6c3 0 5 1 6 3"),
    "vibraslap": p("M6 36h14l4 6H6z", "F") + p("M22 36C24 22 30 14 38 10") + c(40, 9, 4.5, "D"),
    "thunder-sheet-style-gong-scrape": p("M26 3L13 25h10l-5 20 16-26H24l6-16z", "F") + p("M38 30c3 2 3 6 0 8M43 26c4 4 4 12 0 16"),
    "bell-tree": p("M24 3v41") + [0, 1, 2, 3, 4].map((i) => p("M" + (24 - 5 - i * 2) + " " + (11 + i * 7) + "c0-4 " + (2 + i) + "-6 " + (5 + i * 2) + "-6s" + (5 + i * 2) + " 2 " + (5 + i * 2) + " 6z", "F")).join(""),
    "pop": c(24, 24, 9, "F") + p("M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M38 10l-4 4M10 38l4-4M38 38l-4-4") + c(21, 21, 2, "D"),
    "boing": p("M14 40h20") + p("M18 40l12-5-12-5 12-5-12-5 12-5-12-5") + c(24, 7, 4.5, "F"),
    "laser": p("M3 30l8-4 8 4 8-4 8 4 8-4") + star(41, 14, 6) + r(4, 12, 16, 7, "F", 2) + p("M8 19v6"),
    "zoom": p("M18 14h18M10 24h28M18 34h18M4 14h8M4 34h8") + p("M36 10l9 14-9 14z", "F"),
    "whoosh": p("M4 18h24a6 6 0 1 0-6-6M4 26h32a6 6 0 1 1-6 6M4 34h14") + c(41, 12, 3, "F"),
    "sparkle": star(20, 22, 15) + star(38, 10, 6, "D") + star(37, 37, 5, "D"),
    "splash": p("M24 8c6 9 9 14 9 19a9 9 0 0 1-18 0c0-5 3-10 9-19z", "F") + p("M5 40c5-4 10-4 14 0M29 40c5-4 10-4 14 0") + c(9, 28, 2, "D") + c(40, 26, 2.4, "D"),
    "chime": p("M8 6h32M24 6V2") + [[12, 30], [19, 34], [27, 26], [34, 22]].map((q) => p("M" + q[0] + " 6V" + (q[1] - 18)) + r(q[0] - 2.2, q[1] - 18, 4.4, 16, "F", 2)).join("") + c(24, 38, 3.4, "D") + p("M24 24v11"),
    "coin": c(24, 24, 17, "F") + c(24, 24, 12) + star(24, 24, 6, "D"),
    "jump": p("M4 42h40") + p("M8 38c4-24 24-30 32-22", null) + p("M40 16l2 9-9-2", "F") + c(8, 33, 3.5, "D"),
    "power-up": c(24, 24, 18, "F") + p("M24 34V14M16 22l8-8 8 8") + p("M35 8h6M38 5v6"),
    "bubbles": c(17, 28, 11, "F") + c(35, 14, 7, "F") + c(37, 36, 5) + p("M11 24a6 6 0 0 1 6-6") + c(32, 11, 1.6, "D"),
    "rocket": p("M24 3c7 6 9 14 9 22v9H15v-9c0-8 2-16 9-22z", "F") + c(24, 18, 3.5) + p("M15 26l-6 8v6l6-4M33 26l6 8v6l-6-4") + p("M20 38l-2 7M24 38v8M28 38l2 7"),

    // the six categories
    "drums": drumBody(7, 22, 34, 14) + p("M7 26c5 3 29 3 34 0") + p("M6 4l17 16M42 4L25 20"),
    "keys": r(4, 8, 40, 32, "F", 3) + p("M17.3 22v18M30.6 22v18") + r(13, 8, 8, 14, "D", 1) + r(27, 8, 8, 14, "D", 1),
    "strings": p("M24 6c-7 0-11 4-10 9 1 4-5 5-5 11 0 9 7 14 15 14s15-5 15-14c0-6-6-7-5-11 1-5-3-9-10-9z", "F") + p("M21 8v30M27 8v30M17 44h14"),
    "winds": p("M3 30h21a7 7 0 0 0 0-14H12a5 5 0 0 0 0 10h14") + p("M26 21l16-12v30L26 27z", "F") + p("M3 27v6"),
    "bass": c(24, 24, 19, "F") + p("M14 18a8 8 0 1 1 13 6c0 7-6 12-14 15") + c(14.6, 18.2, 2.6, "D") + c(36, 15, 2, "D") + c(36, 26, 2, "D"),
    "fx": p("M8 42L30 20") + r(27, 14, 9, 9, "D", 2) + star(36, 12, 9) + star(13, 12, 4) + star(40, 34, 4),
  };

  const catOf = {};
  function color(id) {
    const I = SS.instruments;
    if (!I) return "#5B8CFF";
    if (!catOf.ready) {
      I.CATEGORIES.forEach((cc) => { catOf[cc.id] = cc.color; });
      I.LIST.forEach((x) => { catOf[x.id] = (I.CATEGORIES.find((cc) => cc.id === x.category) || {}).color; });
      catOf.ready = true;
    }
    return catOf[id] || "#5B8CFF";
  }

  const cache = new Map();
  function svg(id) {
    if (cache.has(id)) return cache.get(id);
    const body = B[id];
    if (!body) return "";
    const col = color(id), dark = shade(col, 0.5);
    const out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="' + dark + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
      + body.replace(/fill="F"/g, 'fill="' + col + '"').replace(/fill="D"/g, 'fill="' + dark + '"') + "</svg>";
    cache.set(id, out);
    return out;
  }

  SS.icons = { svg, ids: () => Object.keys(B), shade };
})(typeof window !== "undefined" ? window : globalThis);
