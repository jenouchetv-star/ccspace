// The writing helper (assets/lib/writer.js): finding the person's own Ollama, how much of the
// site the model is given, the prompts, and reading answers back. A pretend Ollama server stands
// in for the real one, so nothing here needs a model running or touches the network.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  ollamaUrl, chatModels, pickModel, listModels, chat, siteItems, siteDigest, relevantItems, systemPrompt,
  taskMessages, suggestMessages, parseJson, parseDraft, parseTitles, parseEmail, cleanText, paragraphsToHtml,
  cleanSuggestion, recordFacts, subjectIdeas, buttonIdeas, DEFAULT_OLLAMA, NUM_CTX, warm, leanSystem, visionModels, pickVision, pullModel,
} from "../assets/lib/writer.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

/** A pretend Ollama: /api/tags lists models, /api/chat streams newline-delimited JSON. */
function fakeOllama(opts) {
  const o = Object.assign({ models: ["qwen2.5:7b"], pieces: ["Hello ", "there."], status: 200 }, opts || {});
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
    if (o.down) throw new TypeError("Failed to fetch");
    if (String(url).endsWith("/api/tags")) return { ok: o.status === 200, status: o.status, json: async () => ({ models: o.models.map((name) => ({ name })) }) };
    if (o.status !== 200) return { ok: false, status: o.status, json: async () => ({ error: "model not found" }) };
    const lines = o.pieces.map((p) => JSON.stringify({ message: { content: p }, done: false })).concat(JSON.stringify({ done: true })).join("\n") + "\n";
    const bytes = new TextEncoder().encode(lines);
    let at = 0;   // hand the bytes over in awkward 7-byte pieces, so lines are split across reads
    return { ok: true, status: 200, body: { getReader: () => ({ read: async () => {
      if (at >= bytes.length) return { done: true };
      const value = bytes.slice(at, at + 7); at += 7; return { done: false, value };
    } }) } };
  };
  return { fetchImpl, seen };
}

describe("finding the server", () => {
  it("accepts this computer and the local network, and nothing on the internet", () => {
    expect(ollamaUrl("")).toBe(DEFAULT_OLLAMA);
    expect(ollamaUrl("localhost:11434")).toBe("http://localhost:11434");
    expect(ollamaUrl("http://127.0.0.1:11434/")).toBe("http://127.0.0.1:11434");
    expect(ollamaUrl("http://192.168.1.20:11434")).toBe("http://192.168.1.20:11434");
    expect(ollamaUrl("http://studio-mac.local:11434")).toBe("http://studio-mac.local:11434");
    for (const bad of ["https://example.com", "http://8.8.8.8:11434", "ftp://localhost", "http://user:pw@localhost:1", "javascript:alert(1)", "http://localhost.evil.com"]) expect(ollamaUrl(bad)).toBe("");
  });

  it("skips models that cannot write (embeddings, vision, code) and prefers a good general one", () => {
    const names = ["qwen2.5vl:3b", "nomic-embed-text:latest", "qwen3-coder:30b", "gemma2:2b", "qwen2.5:7b", "llama3.1:8b"];
    expect(chatModels(names)).toEqual(["gemma2:2b", "qwen2.5:7b", "llama3.1:8b"]);
    expect(pickModel(names, "")).toBe("qwen2.5:7b");
    expect(pickModel(names, "llama3.1:8b")).toBe("llama3.1:8b");
    expect(pickModel(names, "gone:1b")).toBe("qwen2.5:7b");
    expect(pickModel(["only-one:1b"], "")).toBe("only-one:1b");
    expect(pickModel(["nomic-embed-text"], "")).toBe("");
  });

  it("reports whether the server answered", async () => {
    expect(await listModels("http://localhost:11434", fakeOllama({ models: ["a", "b"] }).fetchImpl)).toEqual({ ok: true, models: ["a", "b"] });
    expect(await listModels("http://localhost:11434", fakeOllama({ down: true }).fetchImpl)).toEqual({ ok: false, models: [] });
    expect(await listModels("http://localhost:11434", fakeOllama({ status: 500 }).fetchImpl)).toEqual({ ok: false, models: [] });
  });
});

describe("chatting", () => {
  it("streams the answer in pieces, even when a line is split across reads, and returns the whole text", async () => {
    const f = fakeOllama({ pieces: ["Come ", "and ", "see."] });
    const got = [];
    const text = await chat({ base: "http://localhost:11434", model: "m", messages: [{ role: "user", content: "hi" }], fetchImpl: f.fetchImpl, onToken: (p) => got.push(p) });
    expect(text).toBe("Come and see.");
    expect(got.join("")).toBe("Come and see.");
  });

  it("asks for JSON when told to, and keeps the model's thinking out of the answer", async () => {
    const f = fakeOllama();
    await chat({ base: "http://localhost:11434", model: "m", messages: [], json: true, fetchImpl: f.fetchImpl });
    const sent = f.seen[0].body;
    expect(f.seen[0].url).toBe("http://localhost:11434/api/chat");
    expect(sent.format).toBe("json");
    expect(sent.think).toBe(false);
    expect(sent.stream).toBe(true);
    expect(sent.options.num_ctx).toBe(NUM_CTX);
  });

  it("turns the server's complaint into a readable error", async () => {
    await expect(chat({ base: "http://localhost:11434", model: "nope", messages: [], fetchImpl: fakeOllama({ status: 404 }).fetchImpl })).rejects.toThrow("model not found");
  });
});

const data = {
  games: [{ id: "g1", title: "Doodle Dash", summary: "Draw a level, then run it.", kind: "embed", status: "published" }, { id: "g2", title: "Secret Draft Game", status: "draft" }],
  videos: [{ id: "v1", title: "Episode Ten", episode: 10, description: "Chike builds a marble run.", status: "published" }],
  stories: [{ id: "story-1", title: "Mateo and the Floating Train", blurb: "Magnets lift a toy train.", status: "published", pages: [1, 2, 3, 4, 5, 6, 7] }],
  activities: [{ id: "a1", title: "Bottle-Cap Marble Run", summary: "Build a run from caps and tape.", ageMin: 5, ageMax: 9, timeMinutes: 30, status: "published" }],
  characters: [{ id: "c1", name: "Chike", slug: "chike", tagline: "Big ideas", strength: "Builder", status: "published" }],
  subscribers: [{ id: "s1", email: "private@example.test", status: "published" }],
  supportTickets: [{ id: "t1", email: "ticket@example.test", message: "private words", status: "published" }],
  newsletters: [{ id: "n1", subject: "Welcome in", previewText: "Hi", status: "sent" }, { id: "n2", subject: "Unsent draft", status: "draft" }],
};

describe("what the helper knows about the site", () => {
  const items = siteItems(data);

  it("lists every published thing, with its page address, and nothing unpublished", () => {
    const titles = items.map((i) => i.title);
    for (const t of ["Doodle Dash", "Episode Ten", "Mateo and the Floating Train", "Bottle-Cap Marble Run", "Chike", "Welcome in"]) expect(titles).toContain(t);
    expect(titles).not.toContain("Secret Draft Game");
    expect(titles).not.toContain("Unsent draft");
    expect(items.find((i) => i.title === "Doodle Dash").path).toBe("/play/g1");
    expect(items.find((i) => i.title === "Mateo and the Floating Train").text).toMatch(/7-page picture book/);
  });

  it("never reads people's emails or messages", () => {
    const everything = JSON.stringify(items) + siteDigest(items) + JSON.stringify(taskMessages("draft", { brand: {}, items, entry: {}, idea: "x" }));
    expect(everything).not.toMatch(/example\.test|private words/);
  });

  it("puts the whole site in the digest by kind, and keeps it within its size", () => {
    const d = siteDigest(items);
    expect(d).toContain("GAME (1): Doodle Dash [/play/g1]");
    expect(d).toContain("EPISODE (1)");
    const many = Array.from({ length: 400 }, (_, i) => ({ kind: "Activity", title: "Activity number " + i, text: "", path: "/activity/" + i }));
    expect(siteDigest(many, 1500).length).toBeLessThan(2000);
  });

  it("finds the few items most related to what is being written", () => {
    const hits = relevantItems(items, "a marble run built from bottle caps");
    expect(hits[0].title).toBe("Bottle-Cap Marble Run");
    expect(relevantItems(items, "zzzz qqqq")).toEqual([]);
    expect(relevantItems(items, "")).toEqual([]);
  });
});

describe("the prompts", () => {
  const items = siteItems(data);
  const ctx = { brand: { name: "Chike's Creative Space", promise: "We turn imagination into action." }, items, entry: { layout: "ebook", title: "Mateo and the Floating Train" }, idea: "our new floating train book" };

  it("tell the model the voice, the facts it may use, and the real site contents", () => {
    const sys = taskMessages("draft", ctx)[0].content;
    expect(sys).toContain("American English");
    expect(sys).toContain("Never invent");
    expect(sys).toContain("Mateo and the Floating Train [/stories/story-1]");
    expect(sys).toContain("MOST RELEVANT DETAILS");
    expect(sys).toMatch(/never PDFs or downloads/);
    expect(sys).toMatch(/never mention prices/);
  });

  it("ask for gentle invitations, not pressure", () => {
    const sys = taskMessages("draft", ctx)[0].content;
    expect(sys).toMatch(/never pressure/i);
    expect(sys).toMatch(/urgent or pushy/i);
    for (const ideas of [buttonIdeas("game"), buttonIdeas("video"), buttonIdeas("ebook"), buttonIdeas("gallery"), buttonIdeas("article"), subjectIdeas("game", "X"), subjectIdeas("ebook", "X")]) {
      expect(ideas.join(" ")).not.toMatch(/\bnow\b|hurry|don't miss/i);
    }
  });

  it("build every job, and describe the entry", () => {
    for (const task of ["draft", "titles", "description", "email", "continue"]) {
      const m = taskMessages(task, ctx);
      expect(m[0].role).toBe("system");
      expect(m[1].content).toContain("interactive ebook");
      expect(m[1].content).toContain("our new floating train book");
    }
    expect(taskMessages("improve", { ...ctx, field: "short description", fieldText: "teh train floats" })[1].content).toContain("teh train floats");
    expect(taskMessages("draft", ctx)[1].content).toMatch(/JSON/);
    expect(() => taskMessages("dance", ctx)).toThrow();
  });

  it("ask for only the next few words when suggesting", () => {
    const m = suggestMessages({ ...ctx, field: "title", fieldText: "Mateo and the" });
    expect(m[1].content).toContain("at most 14");
    expect(m[1].content).toContain("Mateo and the");
  });
});

describe("reading answers back", () => {
  it("reads JSON even with fences or chatter around it", () => {
    expect(parseJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJson("no json here")).toBeNull();
    expect(parseJson("{broken")).toBeNull();
  });

  it("reads a full draft, accepting the email keys under either name", () => {
    const d = parseDraft(JSON.stringify({ title: "A Title", description: "D", body: ["P1", "P2"], subject: "S", preview: "P", message: "M", emailButton: "Take a look" }));
    expect(d).toEqual({ title: "A Title", description: "D", body: "P1\n\nP2", emailSubject: "S", emailPreview: "P", emailMessage: "M", emailButton: "Take a look" });
    expect(parseDraft("{}")).toBeNull();
    expect(parseDraft("nothing")).toBeNull();
  });

  it("reads title ideas and the email", () => {
    expect(parseTitles('{"titles":["One"," Two ","",3]}')).toEqual(["One", "Two", "3"]);
    expect(parseTitles("nope")).toEqual([]);
    expect(parseEmail('{"subject":"S","preview":"P","message":"M","button":"B"}')).toEqual({ subject: "S", preview: "P", message: "M", button: "B" });
  });

  it("tidies a plain answer", () => {
    expect(cleanText('Here is the description: "Draw a level and run it."')).toBe("Draw a level and run it.");
    expect(cleanText("**Bold** text")).toBe("Bold text");
  });

  it("turns paragraphs into safe HTML", () => {
    expect(paragraphsToHtml("One <b>x</b>\n\nTwo & three")).toBe("<p>One &lt;b&gt;x&lt;/b&gt;</p><p>Two &amp; three</p>");
    expect(paragraphsToHtml("")).toBe("");
  });

  it("offers a short continuation that never repeats what was typed", () => {
    expect(cleanSuggestion("Mateo and the Floating Train is here", "Mateo and the")).toBe(" Floating Train is here");
    expect(cleanSuggestion('"a new game"', "Meet")).toBe(" a new game");
    expect(cleanSuggestion("hi", "x")).toBe("");
    expect(cleanSuggestion("x ".repeat(80), "Start").length).toBeLessThanOrEqual(92);
    expect(cleanSuggestion("and more", "Already ends with space ")).toBe("and more");
  });
});

describe("looking at pictures", () => {
  it("finds the models that can see, and prefers the best known one", () => {
    const names = ["qwen2.5vl:3b", "qwen2.5:7b", "llava:13b", "nomic-embed-text", "llama3.2-vision:11b"];
    expect(visionModels(names)).toEqual(["qwen2.5vl:3b", "llava:13b", "llama3.2-vision:11b"]);
    expect(pickVision(names, "")).toBe("qwen2.5vl:3b");
    expect(pickVision(names, "llava:13b")).toBe("llava:13b");
    expect(pickVision(["qwen2.5:7b"], "")).toBe("");
  });
});

/** A pretend Ollama that answers /api/pull with newline-delimited progress, in awkward pieces. */
function fakePull(lines, status) {
  const bytes = new TextEncoder().encode(lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n");
  let at = 0;
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body) });
    if (status && status !== 200) return { ok: false, status, json: async () => ({ error: "pull model manifest: file does not exist" }) };
    return { ok: true, status: 200, body: { getReader: () => ({ read: async () => { if (at >= bytes.length) return { done: true }; const value = bytes.slice(at, at + 9); at += 9; return { done: false, value }; } }) } };
  };
  return { fetchImpl, seen };
}

describe("downloading a model for someone who has none", () => {
  const good = [{ status: "pulling manifest" }, { status: "pulling abc", total: 1000, completed: 250 }, { status: "pulling abc", total: 1000, completed: 1000 }, { status: "verifying sha256 digest" }, { status: "success" }];

  it("asks Ollama to pull the named model and reports progress as a percentage", async () => {
    const f = fakePull(good);
    const got = [];
    expect(await pullModel("http://localhost:11434", "qwen2.5:7b", (p) => got.push(p), undefined, f.fetchImpl)).toBe(true);
    expect(f.seen[0]).toEqual({ url: "http://localhost:11434/api/pull", body: { model: "qwen2.5:7b", stream: true } });
    expect(got.map((p) => p.status)).toEqual(["pulling manifest", "pulling abc", "pulling abc", "verifying sha256 digest", "success"]);
    expect(got.map((p) => p.pct)).toEqual([null, 25, 100, null, null]);
  });

  it("says so when Ollama refuses, reports its own error line, or the download stops early", async () => {
    await expect(pullModel("http://localhost:11434", "nope", null, undefined, fakePull([], 404).fetchImpl)).rejects.toThrow("file does not exist");
    await expect(pullModel("http://localhost:11434", "x", null, undefined, fakePull([{ status: "pulling manifest" }, { error: "disk full" }]).fetchImpl)).rejects.toThrow("disk full");
    await expect(pullModel("http://localhost:11434", "x", null, undefined, fakePull([{ status: "pulling manifest" }, { status: "pulling abc", total: 10, completed: 4 }]).fetchImpl)).rejects.toThrow("stopped before it finished");
  });
});

describe("the guided Ollama setup", () => {
  it("shows in the Copilot panel in place of the chat until the helper is ready, and can be skipped", () => {
    const panel = body("copilotPanelHTML");
    expect(panel).toContain("const setup = cpNeedsSetup();");
    expect(panel).toContain('<div id="ollama-wizard" aria-live="polite">');
    expect(panel).toContain('(setup ? "" : \'<form class="cp-composer"');          // no message box while it is not set up
    expect(body("cpNeedsSetup")).toContain('WriterState.status === "off" || WriterState.status === "nomodel"');
    expect(body("cpNeedsSetup")).toContain("!CopilotState.skipSetup");
    expect(html).toContain('"copilot-skip-setup": () => { CopilotState.skipSetup = true; copilotRender(); },');
    expect(body("ollamaWizardHTML")).toContain('data-act="copilot-skip-setup"');
    expect(html).toContain("if (CopilotState.open && cpNeedsSetup()) ollamaInlineStart(); else OllamaSetup.inline = false;");
  });

  it("tells apart not installed, not allowed from this site, and no model, using what the browser can see", () => {
    const d = body("ollamaDiagnose");
    expect(d).toContain('mode: "no-cors"');                                   // reachable even when this site is not allowed in
    expect(d).toContain('return { state: "notrunning" }');
    expect(d).toContain('return { state: "blocked" }');
    const w = body("ollamaWizardHTML");
    expect(w).toContain("const firstOpen = !installed ? 1 : (!reachable ? 2 : (!hasModel ? 3 : 0));");
    for (const step of ["Install Ollama", "Let this site talk to it", "Download a writing model", "Picture model (optional)"]) expect(w).toContain(step);
  });

  it("walks through each system's own steps, and gives the exact command with this site's address to copy", () => {
    const w = body("ollamaWizardHTML");
    expect(w).toContain("https://ollama.com/download");
    expect(w).toContain("OllamaSetup.exe");
    expect(w).toContain("Applications");
    expect(w).toContain("curl -fsSL https://ollama.com/install.sh | sh");
    expect(w).toContain("setx OLLAMA_ORIGINS");
    expect(w).toContain("launchctl setenv OLLAMA_ORIGINS");
    expect(w).toContain("Environment=\"OLLAMA_ORIGINS=");
    expect(w).toContain("const origin = location.origin;");
    expect(w).toContain("You are on a local copy of the site");                 // not needed when testing on localhost
    expect(body("ollamaOS")).toMatch(/windows[\s\S]*mac[\s\S]*linux/);
  });

  it("downloads the model for them with a progress bar they can cancel, and suggests the lighter one for a small computer", () => {
    expect(body("ollamaPull")).toContain("WriterLib.pullModel(WriterState.base, name");
    expect(body("ollamaPull")).toContain("OllamaSetup.ctl.signal");
    expect(body("ollamaPullBlock")).toContain('role="progressbar"');
    expect(body("ollamaPullBlock")).toContain('data-act="ollama-pull-cancel"');
    expect(body("ollamaWizardHTML")).toContain("navigator.deviceMemory < 8");
    expect(html).toContain('writing: { name: "qwen2.5:7b"');
    expect(html).toContain('light: { name: "qwen2.5:3b"');
    expect(html).toContain('picture: { name: "qwen2.5vl:3b"');
  });

  it("looks again every few seconds so each step ticks off by itself, and says when it is ready", () => {
    expect(body("ollamaPollStart")).toContain("}, 3000);");
    expect(body("ollamaPollStart")).toContain('!document.getElementById("ollama-wizard")');
    expect(body("ollamaWizardRefresh")).toContain('toast("The AI helper is ready.")');
  });

  it("offers the same setup from the Writing helper in every editor, when it is not set up", () => {
    expect(body("ollamaBannerHTML")).toContain("Set up the AI helper");
    expect(body("writerCardHTML") + body("ehCardHTML")).toContain("ollamaBannerHTML()");
    expect(body("writerHelpHTML")).toContain('data-act="ollama-setup"');
    expect(body("writerPaintStatus")).toContain("data-ollama-banner");
    expect(html).toContain('"ollama-setup": (el) => { if (el && el.closest && el.closest(".cp-panel")){');
  });

  it("calls the panel the Admin Assistant, as a small logo", () => {
    const panel = body("copilotPanelHTML");
    expect(panel).toContain('<h2 class="cp-logo" aria-label="Admin Assistant">');
    expect(panel).toContain("<b>Admin</b><i>Assistant</i>");
    expect(panel).not.toContain("Your content assistant");
    expect(html).toContain(".cp-logo__mark{ position:relative; flex:none; width:30px; height:30px;");
  });
});

describe("staying quick", () => {
  it("loads the model ahead of time, with the same context size every other request uses", async () => {
    const f = fakeOllama();
    await warm("http://localhost:11434", "qwen2.5:7b", f.fetchImpl);
    expect(f.seen[0].url).toBe("http://localhost:11434/api/generate");
    expect(f.seen[0].body.options.num_ctx).toBe(NUM_CTX);
    await chat({ base: "http://localhost:11434", model: "m", messages: [], fetchImpl: f.fetchImpl });
    expect(f.seen[1].body.options.num_ctx).toBe(NUM_CTX);   // changing it between calls makes Ollama reload the model
    await expect(warm("http://localhost:11434", "m", fakeOllama({ down: true }).fetchImpl)).resolves.toBeUndefined();
  });

  it("gives suggestions a short brief, not the whole site", () => {
    const items = siteItems(data);
    const m = suggestMessages({ brand: { name: "Chike's Creative Space" }, items, entry: { layout: "game", title: "Doodle Dash" }, field: "title", fieldText: "Draw a level" });
    expect(m[0].content.length).toBeLessThan(900);
    expect(m[0].content).not.toContain("WHAT IS ON THE SITE");
    expect(leanSystem({}, items, "doodle dash")).toContain("Doodle Dash");
  });

  it("drops the leading ellipsis a model puts on a continuation", () => {
    expect(cleanSuggestion("...and see where it lands!", "Drop chips")).toBe(" and see where it lands!");
    expect(cleanSuggestion("…chips in a row", "Line up four")).toBe(" chips in a row");
  });

  it("keeps a suggestion true to what the form already says, so it cannot invent features", () => {
    const rec = {
      id: "portal-gravity-four", layout: "game", title: "Gravity 4", slug: "chikes-gravity-four", status: "published",
      description: "Drop chips", cover: { src: "assets/games/x.gif", alt: "x" }, coverStill: "assets/games/x.webp", publishedAt: "2026-10-26",
      howToPlay: ["Pick who to play against: Chike, a friend, or a friend online.", "Pick a column, then press Drop."],
      vocabWord: "gravity", vocabMeaning: "The invisible pull that brings things down.", aiPromptTip: "a tip", privateGameId: "gravity-four",
      gameLabel: "Play Gravity 4", buttonUrl: "https://example.com/x", email: { on: true, subject: "s" },
    };
    const facts = recordFacts(rec, ["description"]);
    expect(facts).toContain("how to play: Pick who to play against: Chike, a friend, or a friend online.; Pick a column, then press Drop.");
    expect(facts).toContain("vocab word: gravity");
    expect(facts).toContain("game label: Play Gravity 4");
    for (const hidden of ["portal-gravity-four", "published", "assets/games", "2026-10-26", "example.com", "a tip", "gravity-four", "Drop chips"]) expect(facts).not.toContain(hidden);
    expect(recordFacts({ summary: "x".repeat(2000), more: "y".repeat(2000) }).length).toBeLessThan(950);
    expect(recordFacts(null)).toBe("");

    const m = suggestMessages({ brand: {}, items: [], entry: { layout: "game", title: "Gravity 4", facts }, field: "short description", fieldText: "Drop chips" });
    expect(m[1].content).toContain("never add features, rules, levels, characters or details that are not here");
    expect(m[1].content).toContain("Pick a column, then press Drop.");
    expect(m[1].content).toContain("rather than guessing");
    const bare = suggestMessages({ brand: {}, items: [], entry: { layout: "game", title: "Gravity 4" }, field: "title", fieldText: "x" });
    expect(bare[1].content).not.toContain("What the form already says");
  });
});

describe("how the admin uses it", () => {
  it("does not touch the library while the page is still loading: it arrives in a later script", () => {
    const start = html.split("(function writerLoad(){")[1].split("})();")[0];
    expect(start).not.toContain("WriterLib");
  });

  it("lives in the portal entry editor, is on by default, and says how to set up Ollama when it is not running", () => {
    expect(body("openPortalEditor")).toContain("writerCardHTML(rec)");
    expect(body("openPortalEditor")).toContain("writerConnect();");
    expect(body("writerHelpHTML")).toContain("ollama pull qwen2.5:7b");
    expect(body("writerHelpHTML")).toContain("OLLAMA_ORIGINS");
  });

  it("changes nothing until the writer chooses: every result has a Use button", () => {
    const show = body("writerShow");
    for (const what of ["all", "empty", "title", "email", "description", "continue", "improve"]) expect(show).toContain('data-what="' + what + '"');
    expect(body("writerRun")).not.toMatch(/writerSet\(/);
  });

  it("suggests the next few words only after a pause, and Tab adds them while Escape skips", () => {
    expect(body("writerOnInput")).toContain("setTimeout(() => writerSuggest(el), 900)");
    expect(html).toContain('if (ev.key === "Tab" && !ev.shiftKey){ ev.preventDefault(); writerAccept(); }');
    expect(html).toContain('else if (ev.key === "Escape"){ ev.preventDefault(); ev.stopPropagation(); writerClearSuggestion(); }');
  });

  it("offers real games, episodes and books from the site to start from, and fills only empty boxes", () => {
    const opts = body("portalStartOptions");
    for (const w of ['"games"', '"videos"', "BOOKS", '"stories"']) expect(opts).toContain(w);
    expect(body("portalStartFill")).toContain("writerSet(form, name, v, true)");
  });

  it("only talks to this computer: the page's own security policy allows just that address", () => {
    const headers = readFileSync(new URL("../_headers", import.meta.url), "utf8");
    expect(headers).toContain("connect-src 'self' http://localhost:11434 http://127.0.0.1:11434");
  });
});
