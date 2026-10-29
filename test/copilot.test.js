// The admin Copilot (assets/lib/copilot.js plus how index.html wires it in): working out which job a
// message is, checking pasted game code, the prompts, and reading answers back. No model is needed:
// the model only ever writes; what it is asked to write, and what is done with it, is decided here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  findYoutubeIds, extractHtml, chooseIntent, analyzeGameHtml, gameDigest, gameSlug, MAX_GAME_BYTES,
  copilotSystem, chatMessages, episodeMessages, parseEpisode, gameMessages, parseGame, newsletterMessages, parseNewsletter,
  storyMessages, parseStory, storyPagesFrom, whereLabel, quickFixes, planFix, FIXABLE, recordFacts, fixMessages, parseFix, findItemInText, pickField, TEXT_FIELDS, altTargets, altMessages, parseAlt, tagTargets, existingTags, tagMessages, parseTags,
} from "../assets/lib/copilot.js";
import { siteItems, systemPrompt, whoLine, taskMessages } from "../assets/lib/writer.js";
import { portalValidate } from "../assets/lib/portal.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const body = (name) => html.split("function " + name + "(")[1].split("\nfunction ")[0];

const GAME = `<!doctype html><html><head><title>Rocket Dodge</title><meta name="viewport" content="width=device-width"></head>
<body><h1>Rocket Dodge</h1><p>Press space to dodge the asteroids!</p><canvas id="c"></canvas>
<script>const c=document.getElementById('c');let score=0;function loop(){score++;requestAnimationFrame(loop)}loop();</script></body></html>`;

describe("what the admin gave us", () => {
  it("finds every YouTube video once, in any link style, and ignores other links", () => {
    const text = "new: https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3s and https://youtu.be/abcdefghijk, also https://www.youtube.com/shorts/ZZZZZZZZZZZ again https://youtu.be/dQw4w9WgXcQ plus https://example.com/watch?v=12345678901";
    expect(findYoutubeIds(text)).toEqual(["dQw4w9WgXcQ", "abcdefghijk", "ZZZZZZZZZZZ"]);
    expect(findYoutubeIds("no links here")).toEqual([]);
    expect(findYoutubeIds("dQw4w9WgXcQ")).toEqual([]);   // a bare id is not a link
  });

  it("recognizes pasted game code: a whole page, a fenced block, or a long script page", () => {
    expect(extractHtml(GAME)).toBe(GAME.trim());
    expect(extractHtml("Here is my game:\n```html\n" + GAME + "\n```\nthanks")).toBe(GAME.trim());
    expect(extractHtml("intro words " + GAME + " trailing words")).toBe(GAME.trim());
    const bare = "<div>" + "<p>x</p>".repeat(60) + "</div><script>var a=1;</script>";
    expect(extractHtml(bare)).toBe(bare);
    expect(extractHtml("just a normal sentence about <b>games</b>")).toBe("");
  });

  it("decides the job from the message alone", () => {
    expect(chooseIntent(GAME).kind).toBe("game");
    expect(chooseIntent("add https://youtu.be/dQw4w9WgXcQ please")).toMatchObject({ kind: "youtube", ids: ["dQw4w9WgXcQ"] });
    expect(chooseIntent("write a newsletter about Doodle Dash").kind).toBe("newsletter");
    expect(chooseIntent("draft an email to our subscribers about the new book").kind).toBe("newsletter");
    expect(chooseIntent("write a story about a lighthouse").kind).toBe("story");
    expect(chooseIntent("make a picture book where Chike flies").kind).toBe("story");
    expect(chooseIntent("what games do we have?").kind).toBe("chat");
    // talking about a newsletter or a story is not a request to write one
    expect(chooseIntent("Which game should we feature in next month's newsletter, and why?").kind).toBe("chat");
    expect(chooseIntent("how many people get the newsletter?").kind).toBe("chat");
    expect(chooseIntent("What story should we write next?").kind).toBe("chat");
    expect(chooseIntent("newsletter about our new book").kind).toBe("newsletter");
    expect(chooseIntent("Zech and Mateo build a lighthouse", "story").kind).toBe("story");   // answering "what is the story about?"
    expect(chooseIntent("Doodle Dash", "newsletter").kind).toBe("newsletter");
  });

  it("treats code as code even when it mentions a video, and caps a flood of links", () => {
    expect(chooseIntent(GAME + "\n<!-- from https://youtu.be/dQw4w9WgXcQ -->").kind).toBe("game");
    const many = Array.from({ length: 8 }, (_, i) => "https://youtu.be/aaaaaaaaaa" + i).join(" ");
    const r = chooseIntent(many);
    expect(r.ids).toHaveLength(5);
    expect(r.extra).toBe(3);
  });
});

describe("editing what is already on the site", () => {
  const items = siteItems({
    games: [{ id: "g1", title: "Doodle Dash", summary: "Draw a level.", status: "published" }],
    stories: [{ id: "s1", title: "Mateo and the Floating Train", blurb: "Magnets.", status: "published" }, { id: "s2", title: "Mateo", blurb: "short title", status: "published" }],
    activities: [{ id: "a1", title: "Bottle-Cap Marble Run", summary: "Caps.", status: "published" }],
  });

  it("finds the page being talked about, preferring the longest title", () => {
    expect(findItemInText(items, "shorten the Mateo and the Floating Train blurb").id).toBe("s1");
    expect(findItemInText(items, "tell me about Mateo").id).toBe("s2");
    expect(findItemInText(items, "nothing here")).toBeNull();
    expect(findItemInText(items, "dd")).toBeNull();
  });

  it("treats a request to change a named page as an update, in many wordings", () => {
    for (const msg of ["Make the Doodle Dash summary friendlier and mention playing with a friend", "Rewrite the description of Doodle Dash", "shorten Bottle-Cap Marble Run", "Please improve the Doodle Dash summary", "update Doodle Dash to say it works on tablets"]) {
      expect(chooseIntent(msg, "", items)).toMatchObject({ kind: "update" });
    }
    expect(chooseIntent("make Doodle Dash friendlier", "", items).item.title).toBe("Doodle Dash");
  });

  it("does not edit anything when it is only asked a question, or when no page is named", () => {
    expect(chooseIntent("Is the Doodle Dash summary too long?", "", items).kind).toBe("chat");
    expect(chooseIntent("what do you think of Doodle Dash", "", items).kind).toBe("chat");
    expect(chooseIntent("make the summary friendlier", "", items).kind).toBe("chat");
    expect(chooseIntent("Rewrite the Doodle Dash newsletter", "", items).kind).not.toBe("update");
  });

  it("treats pasted text with an instruction as text to revise", () => {
    const pasted = "Shorten this:\n\nWelcome to our studio where kids make amazing things every single day, with cardboard, paint, tape and big ideas that grow.";
    expect(chooseIntent(pasted, "", items)).toMatchObject({ kind: "revise" });
    expect(chooseIntent("make this warmer: \u201CWe are open Monday.\u201D", "", items).kind).toBe("revise");
    expect(chooseIntent("fix it", "", items).kind).toBe("chat");
  });

  it("recognizes the housekeeping jobs from plain words", () => {
    for (const m of ["write alt text for the images missing it", "add image descriptions", "describe all the pictures", "fix the image tags"]) expect(chooseIntent(m, "", items).kind).toBe("alt");
    for (const m of ["suggest tags for the activities that have none", "add tags to my activities", "tags are missing"]) expect(chooseIntent(m, "", items).kind).toBe("tags");
    for (const m of ["What needs attention?", "any content problems?", "what is broken"]) expect(chooseIntent(m, "", items).kind).toBe("attention");
  });

  it("picks the right box of a record to rewrite", () => {
    expect(pickField("games", "make the summary friendlier").path).toBe("summary");
    expect(pickField("games", "rewrite the rules").path).toBe("rules");
    expect(pickField("stories", "change the opening line").path).toBe("opening");
    expect(pickField("stories", "improve it").path).toBe("blurb");
    expect(pickField("activities", "the discussion question is dull").path).toBe("discussionPrompt");
    expect(pickField("portalEntries", "rewrite the text").type).toBe("richtext");
    expect(pickField("nonsense", "x")).toBeNull();
  });

  it("only offers to rewrite descriptive text, never titles or addresses", () => {
    for (const fields of Object.values(TEXT_FIELDS)) for (const f of fields) expect(f.path).not.toMatch(/^(title|name|slug|id|path|key|youtubeId|youtubeUrl|url)$/);
  });

  it("finds pictures with no description, and ignores archived ones, videos and ones that have it", () => {
    const data = {
      activities: [{ id: "a1", title: "Kite", status: "published", image: { src: "assets/kite.jpg", alt: "" }, summary: "Fly it." }, { id: "a2", title: "Has alt", image: { src: "x.jpg", alt: "A kite" } }, { id: "a3", title: "Old", status: "archived", image: { src: "y.jpg", alt: "" } }, { id: "a4", title: "No picture", image: { src: "", alt: "" } }],
      videos: [{ id: "v1", title: "Ep", thumb: { src: "https://i.ytimg.com/t.jpg", alt: "  " } }],
      mediaAssets: [{ id: "m1", path: "assets/a.png", alt: "", usage: "Hero" }, { id: "m2", path: "assets/clip.mp4", alt: "", kind: "video" }, { id: "m3", path: "assets/b.png", alt: "Fine" }],
    };
    const t = altTargets(data);
    expect(t.map((x) => x.col + ":" + x.id)).toEqual(["activities:a1", "videos:v1", "mediaAssets:m1"]);
    expect(t[0]).toMatchObject({ altPath: "image.alt", srcPath: "image.src", context: "Fly it." });
    expect(t[2]).toMatchObject({ altPath: "alt", src: "assets/a.png" });
  });

  it("asks for one plain sentence, and says when the model cannot see the picture", () => {
    const target = { col: "activities", title: "Kite", context: "Fly it." };
    const sees = altMessages({ target, image: "BASE64" }, true);
    expect(sees[1].images).toEqual(["BASE64"]);
    expect(sees[1].content).toMatch(/Look at this picture/);
    expect(sees[1].content).toMatch(/under 22 words/);
    const blind = altMessages({ target }, false);
    expect(blind[1].images).toBeUndefined();
    expect(blind[1].content).toMatch(/cannot see the picture/);
  });

  it("cleans a description: one sentence, no 'image of', capitalized, ends with a full stop", () => {
    expect(parseAlt('Alt text: "an image of children flying a kite"')).toBe("Children flying a kite.");
    expect(parseAlt("A picture of two kids.\nThey are smiling.")).toBe("Two kids.");
    expect(parseAlt("Kids build a rocket!")).toBe("Kids build a rocket!");
    expect(parseAlt("x ".repeat(200)).length).toBeLessThanOrEqual(172);
    expect(parseAlt("")).toBe("");
  });

  it("suggests tags that reuse the ones already on the site", () => {
    const data = { activities: [{ id: "1", title: "A", tags: ["Paper", "kites"], status: "published" }, { id: "2", title: "B", tags: ["paper"], status: "published" }, { id: "3", title: "C", tags: [], summary: "s", status: "published" }, { id: "4", title: "D", status: "archived" }] };
    expect(tagTargets(data).map((x) => x.id)).toEqual(["3"]);
    expect(existingTags(data)).toEqual(["paper", "kites"]);
    expect(tagMessages({ target: { title: "C" }, existing: ["paper", "kites"] })[1].content).toContain("prefer these");
    expect(parseTags('{"tags":["Paper Planes","KITES!","paper planes","a very very very very long tag indeed", ""]}')).toEqual(["paper planes", "kites"]);
    expect(parseTags("nope")).toEqual([]);
  });

  it("every item on the site says which record it is, so a change can be applied to the right one", () => {
    expect(items.find((i) => i.title === "Doodle Dash")).toMatchObject({ col: "games", id: "g1" });
    expect(items.find((i) => i.title === "Bottle-Cap Marble Run")).toMatchObject({ col: "activities", id: "a1" });
  });
});

describe("helping fix what blocks publishing", () => {
  const kite = { id: "k", title: "The Weather-Watcher Kite", status: "draft", summary: "Fly a kite.", image: { src: "assets/kite.jpg", alt: "" }, steps: ["one"], ageMin: 9, ageMax: 4, tags: [] };
  const errs = [
    { field: "steps", message: "At least three numbered steps are required." },
    { field: "learning.title", message: "Learning nugget headline is required." },
    { field: "image.alt", message: "Alt text is required whenever a cover image is set." },
    { field: "ageMin", message: "Minimum age is above maximum age." },
    { field: "steps", message: "again" },
  ];

  it("sorts the problems into: write it, describe the picture, or only a person can decide", () => {
    const plan = planFix("activities", kite, errs);
    expect(plan.fillable.map((f) => f.path)).toEqual(["steps", "learning.title"]);
    expect(plan.fillable[0]).toMatchObject({ type: "lines", label: "numbered steps" });
    expect(plan.alts).toEqual([{ altPath: "image.alt", srcPath: "image.src", src: "assets/kite.jpg", message: "Alt text is required whenever a cover image is set." }]);
    expect(plan.manual.map((m) => m.field)).toEqual(["ageMin"]);
  });

  it("never offers to guess a decision: a video that is not Live, a deleted link, an age range", () => {
    const plan = planFix("videos", { id: "v" }, [{ field: "videoState", message: "Video state must be Live" }, { field: "youtubeId", message: "needs an id" }, { field: "linkedActivity", message: "gone" }]);
    expect(plan.fillable).toEqual([]);
    expect(plan.manual).toHaveLength(3);
    expect(planFix("games", {}, [{ field: "leadsTo", message: "x" }]).manual).toHaveLength(1);
  });

  it("does not try to describe a picture that is not there", () => {
    expect(planFix("activities", { image: { src: "", alt: "" } }, [{ field: "image.alt", message: "x" }]).alts).toEqual([]);
  });

  it("only offers to write plain descriptive parts, never titles, addresses or ids", () => {
    for (const fields of Object.values(FIXABLE)) for (const k of Object.keys(fields)) expect(k).not.toMatch(/^(title|name|slug|id|path|key|youtubeId|youtubeUrl|url|videoState|status|character|leadsTo|linkedActivity)$/);
  });

  it("shows the model only the text already on the record", () => {
    const facts = recordFacts({ id: "x", slug: "s", status: "draft", title: "Kite", summary: "Fly <b>it</b>.", steps: ["a", "b"], learning: { title: "Wind", text: "" }, image: { src: "a.jpg", alt: "" }, pages: [1, 2], featured: true });
    expect(facts).toContain("title: Kite");
    expect(facts).toContain("summary: Fly it .");
    expect(facts).toContain("steps: a; b");
    expect(facts).toContain("learning.title: Wind");
    expect(facts).not.toMatch(/slug|status|featured|a\.jpg/);
  });

  it("asks for exactly the missing keys, and for a placeholder when something cannot be known", () => {
    const missing = planFix("activities", kite, errs).fillable;
    const m = fixMessages({ brand, items, item: { kind: "Activity", title: "The Weather-Watcher Kite" }, facts: "summary: Fly a kite.", missing });
    expect(m[1].content).toContain("keys are exactly: steps, learning.title");
    expect(m[1].content).toMatch(/\[placeholder\]/);
    expect(m[1].content).toContain("steps (numbered steps; at least three short steps, one per item) - an array of strings");
  });

  it("reads the answer in the right shape and keeps only what was asked for", () => {
    const missing = planFix("activities", { id: "x" }, [{ field: "steps", message: "" }, { field: "learning.title", message: "" }, { field: "timeMinutes", message: "" }, { field: "variation", message: "" }]).fillable;
    const out = parseFix(JSON.stringify({ steps: ["1. Cut paper", "- Tape it", " Fly it ", ""], "learning.title": "  Wind pushes  ", timeMinutes: "25", variation: "", extra: "ignored" }), missing);
    expect(out).toEqual({ steps: ["Cut paper", "Tape it", "Fly it"], "learning.title": "Wind pushes", timeMinutes: 25 });
    expect(parseFix(JSON.stringify({ steps: "One\nTwo" }), missing).steps).toEqual(["One", "Two"]);
    expect(parseFix(JSON.stringify({ timeMinutes: -3 }), missing)).toEqual({});
    expect(parseFix("nope", missing)).toEqual({});
  });

  it("understands 'address the issues for <page>', even for a draft the public list does not show", () => {
    const withDraft = siteItems({ activities: [{ id: "k", title: "The Weather-Watcher Kite", status: "draft", summary: "s" }, { id: "p", title: "Paper Planes", status: "published", summary: "s" }] }, { drafts: true });
    expect(chooseIntent("address the issues for The Weather-Watcher Kite", "", withDraft)).toMatchObject({ kind: "fix", item: { id: "k", draft: true } });
    expect(chooseIntent("please fix the problems with Paper Planes", "", withDraft)).toMatchObject({ kind: "fix", item: { id: "p" } });
    expect(chooseIntent("help me fix these", "", withDraft).kind).toBe("fixall");
    expect(chooseIntent("resolve the issues", "", withDraft).kind).toBe("fixall");
    // a normal edit request is still an edit, and a question is still a question
    expect(chooseIntent("fix the Paper Planes summary", "", withDraft).kind).toBe("update");
    expect(chooseIntent("what issues does Paper Planes have?", "", withDraft).kind).not.toBe("fix");
  });

  it("keeps drafts out of what the model is told is live, but lets the Copilot find them to edit", () => {
    const data = { activities: [{ id: "k", title: "Kite", status: "draft" }, { id: "p", title: "Planes", status: "published" }] };
    expect(siteItems(data).map((i) => i.title)).toEqual(["Planes"]);
    expect(siteItems(data, { drafts: true }).map((i) => i.title + ":" + i.draft)).toEqual(["Kite:true", "Planes:false"]);
    expect(copilotSystem(brand, siteItems(data), "x", "")).toMatch(/drafts or unpublished and are not in the list/);
  });
});

describe("adding to the Subscriber’s Portal from the Copilot", () => {
  const items = siteItems({ games: [{ id: "g1", title: "Doodle Dash", summary: "Draw a level.", status: "published", path: "games/Doodle-Dash.html" }], stories: [{ id: "story-city", title: "Mateo and the Floating Train", blurb: "Magnets.", status: "published" }] }, { drafts: true });

  it("recognizes a request for archive content in many wordings", () => {
    for (const m of ["Add Doodle Dash to the Subscriber’s Portal", "put this in the members-only archive", "write something for the members corner", "make a subscriber-only post about our new game", "new portal entry about the book", "exclusive content for subscribers: a sneak peek"]) {
      expect(chooseIntent(m, "", items).kind).toBe("portal");
    }
    expect(chooseIntent("anything", "portal", items).kind).toBe("portal");           // answering the starter's question
  });

  it("takes the video link and the named page along, and does not mistake it for a plain episode", () => {
    const r = chooseIntent("Put https://youtu.be/dQw4w9WgXcQ in the newsletter archive", "", items);
    expect(r).toMatchObject({ kind: "portal", youtubeIds: ["dQw4w9WgXcQ"] });
    expect(chooseIntent("add https://youtu.be/dQw4w9WgXcQ", "", items).kind).toBe("youtube");     // no archive mentioned: a new episode
    expect(chooseIntent("Add Doodle Dash to the Subscriber’s Portal", "", items).item).toMatchObject({ id: "g1", col: "games" });
    expect(chooseIntent("write a newsletter about Doodle Dash", "", items).kind).toBe("newsletter");   // an email is not an archive entry
  });

  it("lets an archive game entry name a game on the site instead of a file", () => {
    const base = { title: "T", description: "D", category: "New games", publishedAt: "2026-10-01", layout: "game", cover: { src: "", alt: "" } };
    expect(portalValidate({ ...base, gameId: "g1" }, []).filter((v) => v.level === "error")).toEqual([]);
    expect(portalValidate({ ...base }, []).filter((v) => v.level === "error").map((v) => v.field)).toEqual(["gamePath"]);
    expect(portalValidate({ ...base, gamePath: "javascript:alert(1)" }, []).filter((v) => v.level === "error").map((v) => v.field)).toEqual(["gamePath"]);
  });
});

describe("one-tap fixes that need no writing", () => {
  const e = (field) => ({ field, message: field + " problem" });

  it("offers to mark an episode Live only when it has a video, and starts that unticked", () => {
    const q = quickFixes("videos", { youtubeId: "dQw4w9WgXcQ", videoState: "concept" }, [e("videoState")]);
    expect(q.rows).toEqual([expect.objectContaining({ path: "videoState", value: "live", risky: true })]);
    expect(q.covered).toEqual(["videoState"]);
  });

  it("says what to do instead when there is no video yet", () => {
    const q = quickFixes("videos", { youtubeId: "", videoState: "concept" }, [e("videoState")]);
    expect(q.rows).toEqual([]);
    expect(q.covered).toEqual([]);
    expect(q.advice.videoState).toMatch(/no YouTube video yet/);
  });

  it("takes a missing video id from the watch link, and swaps ages that are the wrong way round", () => {
    expect(quickFixes("videos", { youtubeId: "", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, [e("youtubeId")]).rows[0]).toMatchObject({ path: "youtubeId", value: "dQw4w9WgXcQ" });
    const ages = quickFixes("activities", { ageMin: 9, ageMax: 4 }, [e("ageMin")]);
    expect(ages.rows.map((r) => r.path + "=" + r.value)).toEqual(["ageMin=4", "ageMax=9"]);
    expect(quickFixes("activities", { ageMin: 4, ageMax: 9 }, [e("ageMin")]).rows).toEqual([]);
    expect(quickFixes("games", {}, [e("leadsTo")])).toEqual({ rows: [], covered: [], advice: {} });
  });
});

describe("checking pasted game code", () => {
  it("reads the name and size, and passes a self-contained game", () => {
    const a = analyzeGameHtml(GAME);
    expect(a.title).toBe("Rocket Dodge");
    expect(a.blocked).toBe(false);
    expect(a.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });

  it("warns about files that will not be there, saving to the browser and a missing phone line", () => {
    const a = analyzeGameHtml('<html><body><img src="hero.png"><script src="game.js"></script><link href="style.css"><div style="background:url(bg.jpg)"></div><script>localStorage.setItem("s",1)</script></body></html>');
    const text = a.warnings.map((w) => w.text).join(" ");
    expect(text).toMatch(/hero\.png/);
    expect(text).toMatch(/game\.js/);
    expect(text).toMatch(/save to the browser/);
    expect(text).toMatch(/viewport/);
    expect(a.usesStorage).toBe(true);
    expect(a.blocked).toBe(false);
  });

  it("does not warn about full links, data pictures or page anchors, and mentions outside hosts calmly", () => {
    const a = analyzeGameHtml('<html><body><img src="data:image/png;base64,AAA"><a href="#top">x</a><img src="https://cdn.example.com/a.png"><script>1</script><meta name="viewport" content="x"></body></html>');
    expect(a.warnings.some((w) => /will not be there/.test(w.text))).toBe(false);
    expect(a.warnings.find((w) => w.level === "info").text).toMatch(/cdn\.example\.com/);
  });

  it("refuses code that is too big, and notes a page with no script", () => {
    const big = analyzeGameHtml("<html><script>/*" + "x".repeat(MAX_GAME_BYTES + 10) + "*/</script></html>");
    expect(big.blocked).toBe(true);
    expect(analyzeGameHtml("<html><body>hi</body></html>").warnings.some((w) => /no script/.test(w.text))).toBe(true);
  });

  it("gives the model the words on the page and the start of the code, not the whole file", () => {
    const d = gameDigest(GAME + "<script>" + "a=1;".repeat(5000) + "</script>");
    expect(d.visible).toContain("Press space to dodge the asteroids!");
    expect(d.code.length).toBeLessThanOrEqual(3200);
    expect(d.visible).not.toContain("requestAnimationFrame");
    expect(gameSlug("Rocket Dodge!")).toBe("rocket-dodge");
    expect(gameSlug("")).toBe("game");
  });
});

const data = {
  games: [{ id: "g1", title: "Doodle Dash", summary: "Draw a level.", status: "published" }],
  characters: [{ id: "c1", name: "Chike", slug: "chike", tagline: "Big ideas", status: "published" }, { id: "c2", name: "Zech", slug: "zech", status: "published" }],
};
const items = siteItems(data);
const brand = { name: "Chike's Creative Space", promise: "We turn imagination into action." };

describe("knowing who is asking", () => {
  const who = { name: "Jeno Uche", first: "Jeno", today: "Monday, October 26, 2026" };
  const items = siteItems({ games: [{ id: "g1", title: "Doodle Dash", summary: "Draw.", status: "published" }] });

  it("says the person's name, that they are an admin, and today's date", () => {
    const line = whoLine(who);
    expect(line).toContain("You are talking with Jeno Uche (call them Jeno), an admin of this site");
    expect(line).toContain("If they ask who they are, tell them");
    expect(line).toContain("Greet them by first name");
    expect(line).toContain("Today is Monday, October 26, 2026.");
    expect(whoLine({ today: "Tuesday" })).toBe("Today is Tuesday.");               // nobody signed in: just the date
    expect(whoLine()).toMatch(/^Today is \w+day, \w+ \d+, \d{4}\.$/);
  });

  it("is in every message the Copilot and the writing helper build", () => {
    const ctx = { brand: { name: "Chike's Creative Space" }, items, where: "the Games list", who, request: "x", item: { kind: "Game", title: "Doodle Dash" }, field: { label: "summary", type: "text" }, before: "b", video: { title: "V" }, analysis: {}, digest: {}, missing: [] };
    const all = [chatMessages([{ role: "user", text: "hi" }], ctx), episodeMessages(ctx), gameMessages(ctx), newsletterMessages(ctx), storyMessages({ ...ctx, characters: [], values: [] }), fixMessages(ctx), taskMessages("draft", { ...ctx, entry: {} }), copilotSystem(ctx.brand, items, "x", "", who)];
    for (const m of all) expect(typeof m === "string" ? m : m[0].content).toContain("You are talking with Jeno Uche");
    expect(systemPrompt({ name: "X" }, "", [], who)).toContain("call them Jeno");
  });

  it("uses the name only, never the email address", () => {
    const sys = copilotSystem(brand, items, "x", "", { name: "Jeno Uche", first: "Jeno", email: "jeno@example.test", today: "Monday" });
    expect(sys).not.toContain("example.test");
    expect(sys).not.toContain("@");
  });

  it("takes the name from the admin profile and greets them by first name", () => {
    expect(body("cpWho")).toContain("AuthState.profile");
    expect(body("cpWho")).not.toMatch(/email/);
    expect(html).toContain("where: cpWhere(), who: cpWho() }");
    expect(html).toContain('(cpWho().first ? "Hi " + E(cpWho().first) + "! " : "Hi! ")');
    expect(body("ehRun")).toContain("who: cpWho()");
    expect(body("cpPortal")).toContain("who: cpWho()");
  });
});

describe("the prompts", () => {
  it("brief the model as the admin's assistant, on the screen they are looking at, with the whole site", () => {
    const sys = copilotSystem(brand, items, "the Games list", "doodle");
    expect(sys).toContain("Copilot for the admin");
    expect(sys).toContain("currently on: the Games list");
    expect(sys).toContain("Doodle Dash [/play/g1]");
    expect(sys).toContain("American English");
    expect(sys).toMatch(/never pressure/i);
  });

  it("keep only the recent turns of a chat", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "message " + i }));
    const m = chatMessages(history, { brand, items, where: "the Dashboard" });
    expect(m[0].role).toBe("system");
    expect(m.length).toBe(9);
    expect(m[m.length - 1].content).toBe("message 19");
  });

  it("ask only for what the title and notes support, and name the real cast", () => {
    const m = episodeMessages({ brand, items, video: { title: "Chike builds a marble run" }, notes: "behind the scenes", cast: ["Chike", "Zech"] });
    expect(m[1].content).toContain("Chike builds a marble run");
    expect(m[1].content).toContain("behind the scenes");
    expect(m[1].content).toContain("Cast available on the site: Chike, Zech");
    expect(m[1].content).toMatch(/leave out anything you cannot know/);
  });

  it("show the model what the game's code shows, and say not to invent features", () => {
    const m = gameMessages({ brand, items, analysis: analyzeGameHtml(GAME), digest: gameDigest(GAME) });
    expect(m[1].content).toContain("Rocket Dodge");
    expect(m[1].content).toContain("Press space to dodge the asteroids!");
    expect(m[1].content).toMatch(/do not invent features/);
  });

  it("let the newsletter button point only at real pages", () => {
    expect(newsletterMessages({ brand, items, request: "tell everyone about Doodle Dash" })[1].content).toMatch(/page address from the site list/);
    expect(storyMessages({ brand, items, request: "a lighthouse", characters: [{ name: "Chike", slug: "chike" }], values: ["kindness"] })[1].content).toContain("Chike (chike)");
  });
});

describe("keeping newsletter text true to the site", () => {
  const site = siteItems({
    games: [{ id: "game-doodle-dash", title: "Doodle Dash", summary: "Draw a level, then run and collect coins.", kind: "embed", status: "published", rules: ["Draw a level with markers.", "Press Share code to play with a friend."] }],
    portalEntries: [{ id: "p1", slug: "chike-s-creative-space-is-here-explore-our-new-website", title: "Explore Our New Website", description: "Check out the latest adventure with Chike and Zech in space!", status: "published" }],
  });

  it("gives the model the game's own summary and rules, and says a game is played, not watched", () => {
    const m = newsletterMessages({ brand, items: site, request: "tell everyone about Doodle Dash" })[1].content;
    expect(m).toContain("Game (a game kids play on the site (not a video)): Doodle Dash [/play/game-doodle-dash]");
    expect(m).toContain("How it works: Draw a level with markers. Press Share code to play with a friend.");
    expect(m).toMatch(/A game is played, never watched/);
    expect(m).toMatch(/Do not say who guides it/);
  });

  it("finds the page a pasted link points to, even when the link's words match nothing else", () => {
    const m = newsletterMessages({ brand, items: site, request: "on this page http://localhost:4321/newsletter/chike-s-creative-space-is-here-explore-our-new-website" })[1].content;
    expect(m).toContain("Archive entry");
    expect(m).toContain("Check out the latest adventure with Chike and Zech in space!");
    expect(m).not.toContain("Doodle Dash [");
  });

  it("admits when nothing matched instead of inventing", () => {
    expect(newsletterMessages({ brand, items: site, request: "something unrelated" })[1].content).toContain("leave a [placeholder]");
  });
});

describe("reading what the model wrote", () => {
  const cast = [{ slug: "chike", name: "Chike" }, { slug: "zech", name: "Zech" }];

  it("episodes: keeps the text, and only cast who exist", () => {
    const e = parseEpisode(JSON.stringify({ description: "A marble run!", learning: "Slopes", moral: "Patience", cast: ["chike", "Nobody", "ZECH", "Chike"] }), cast);
    expect(e).toEqual({ description: "A marble run!", learning: "Slopes", moral: "Patience", cast: ["chike", "zech"] });
    expect(parseEpisode("nonsense", cast)).toBeNull();
    expect(parseEpisode("{}", cast)).toBeNull();
  });

  it("games: tidy rules and sensible numbers", () => {
    const g = parseGame(JSON.stringify({ title: " Rocket Dodge ", summary: "Dodge rocks.", rules: ["Press space", "", "Dodge"], players: "1", minutes: "999", ageMin: 9, ageMax: 4 }));
    expect(g).toEqual({ title: "Rocket Dodge", summary: "Dodge rocks.", rules: ["Press space", "Dodge"], players: "1", minutes: 120, ageMin: 9, ageMax: 9 });
    expect(parseGame(JSON.stringify({ title: "X", rules: "One\nTwo" })).rules).toEqual(["One", "Two"]);
    expect(parseGame("no")).toBeNull();
  });

  it("newsletters: needs a subject and a message, and a button page that exists", () => {
    const ok = JSON.stringify({ subject: "Doodle Dash is here", preview: "p", label: "new game", headline: "H", paragraphs: ["One.", "Two."], buttonLabel: "Come and play", buttonPath: "/play/g1" });
    expect(parseNewsletter(ok, ["/play/g1"])).toMatchObject({ subject: "Doodle Dash is here", label: "NEW GAME", buttonPath: "/play/g1", paragraphs: ["One.", "Two."] });
    expect(parseNewsletter(ok, ["/play/other"]).buttonPath).toBe("/");              // an address the model made up is replaced
    expect(parseNewsletter(JSON.stringify({ subject: "S", paragraphs: [] }), [])).toBeNull();
    expect(parseNewsletter(JSON.stringify({ subject: "S", paragraphs: ["x"], buttonPath: "https://evil.example" }), []).buttonPath).toBe("/");
  });

  it("stories: valid value and character, a handful of short pages", () => {
    const opts = { characters: [{ slug: "chike" }, { slug: "zech" }], values: ["kindness", "courage"] };
    const raw = JSON.stringify({ title: "The Lighthouse", blurb: "b", opening: "", learning: "l", value: "COURAGE", character: "Zech", readMinutes: 4, ageMin: 5, ageMax: 8, pages: ["One.", "Two.", "x".repeat(900)] });
    const s = parseStory(raw, opts);
    expect(s.value).toBe("courage");
    expect(s.character).toBe("zech");
    expect(s.opening).toBe("One.");
    expect(s.readMinutes).toBe(2);                    // worked out from the pages, not taken from the model
    expect(s.pages[2].length).toBeLessThanOrEqual(320);
    expect(parseStory(JSON.stringify({ title: "T", value: "made up", character: "ghost", pages: ["a", "b"] }), opts)).toMatchObject({ value: "kindness", character: "chike" });
    expect(parseStory(JSON.stringify({ title: "T", pages: ["only one"] }), opts)).toBeNull();
  });

  it("builds editable story pages: the title on the first, one text per page, safe text", () => {
    let n = 0;
    const pages = storyPagesFrom("The <Lighthouse>", ["First & last.", "Second."], (p) => p + "-" + ++n);
    expect(pages).toHaveLength(2);
    expect(pages[0].layers.map((l) => l.style)).toEqual(["heading", "body"]);
    expect(pages[0].layers[0].content).toBe("<p>The &lt;Lighthouse&gt;</p>");
    expect(pages[0].layers[1].content).toBe("<p>First &amp; last.</p>");
    expect(pages[1].layers).toHaveLength(1);
    expect(pages[0].background).toEqual({ type: "color", value: "#FDECEA" });
    expect(new Set(pages.map((p) => p.id)).size).toBe(2);
  });

  it("describes where the admin is", () => {
    expect(whereLabel({ name: "admin", params: { section: "games" } })).toBe("the Games list");
    expect(whereLabel({ name: "admin", params: { section: "mystery" } })).toBe("the mystery section");
    expect(whereLabel({ name: "home" })).toBe("the public site");
  });
});

describe("how the admin screen uses it", () => {
  it("is on every admin page and closes the Quick update panel when it opens, and vice versa", () => {
    expect(html).toContain('<div id="copilot-root"></div>');
    expect(html).toContain("  renderQuickUpdatePanel();\n  copilotRender();");
    expect(body("copilotRender")).toContain("isActiveAdmin()");
    expect(html).toContain("if (AppState.admin.quickUpdate.panelOpen && CopilotState.open){ CopilotState.open = false; copilotRender(); }");
  });

  it("is a side panel that makes room for itself, and only floats over the page on a phone-sized window", () => {
    expect(html).toContain("body.cp-panel-open #app{ margin-right:var(--cp-w); transition:margin-right .2s ease; }");
    expect(html).toContain("body.cp-panel-open{ --cp-w:clamp(340px, 30vw, 440px); }");
    const phone = html.split("@media (max-width:899px){\n  .cp-panel{ width:100vw; }")[1].split("}\n")[0];
    expect(phone).toContain("body.cp-panel-open #app{ margin-right:0;");
    expect(html).not.toMatch(/@media \(max-width:1599px\)\{\s*\.cp-panel/);   // no overlay on ordinary laptop widths
  });

  it("empties the message box when a message is sent (the re-draw reads the box back into the draft)", () => {
    const send = body("copilotSend");
    expect(body("copilotRender")).toContain("CopilotState.draft = old.value");
    expect(send).toContain('document.getElementById("cp-input")');
    expect(send).toContain('.value = ""');
    expect(send.indexOf('.value = ""')).toBeLessThan(send.indexOf("CopilotState.busy = true; copilotRender()"));
  });

  it("saves nothing until a button on a proposal is pressed", () => {
    for (const fn of ["copilotSend", "cpYoutube", "cpGame", "cpNewsletter", "cpStory", "cpChat"]) expect(body(fn)).not.toMatch(/db\.(add|update|remove)|\.upsert\(/);
    expect(body("copilotSave")).toContain('m.card.state === "saved"');             // pressing twice does not save twice
    expect(body("copilotSave")).toMatch(/status: "draft"/);
    expect(body("copilotSave")).not.toContain('status: "published"');
  });

  it("stores a game's code in game_files and undoes the listing if that fails", () => {
    const save = body("copilotSave");
    expect(save).toContain('sb.from("game_files").upsert');
    expect(save).toContain('db.remove("games", rec.id, true)');
    expect(save).toContain("hasFile: true");
    expect(save).toContain("game-files.sql");
  });

  it("runs pasted games in a sealed box that cannot read the site's storage or sign-ins", () => {
    const stage = body("gameStage");
    expect(stage).toContain('srcdoc="');
    expect(stage).toContain('sandbox="allow-scripts allow-popups"');
    const srcdoc = stage.split('g.srcdoc !== undefined')[1].split(": '<iframe id=\"gamestage-frame\" src=")[0];
    expect(srcdoc).not.toContain("allow-same-origin");
    expect(body("loadGameHtml")).toContain('sb.from("game_files")');
  });

  it("lets a game with stored code be played and published without a file path", () => {
    expect(body("gamePoster")).toContain("!g.path && !g.hasFile");
    expect(html).toContain('isBlank(r.path) && !r.hasFile');
    expect(body("openGameStage")).toContain("loadGameHtml(g.id)");
  });

  it("proposes changes to existing pages and writes nothing until a button is pressed", () => {
    for (const fn of ["cpUpdate", "cpRevise", "cpAlt", "cpTags", "cpAttention"]) expect(body(fn)).not.toMatch(/db\.(add|update|remove)\(/);
    expect(html).toContain('(m.card.type === "batch" ? copilotApplyBatch(id) : m.card.type === "fix" ? copilotApplyFix(id) : copilotApplyUpdate(id))');
    expect(body("copilotApplyUpdate")).toContain('m.card.state === "saved"');
    expect(body("copilotApplyBatch")).toContain('m.card.state === "saved"');
  });

  it("refuses an edit that would leave a page unable to be published, and never touches titles", () => {
    const apply = body("copilotApplyUpdate");
    expect(apply).toContain("errorsOf(d.col, next)");
    expect(apply.indexOf("worse.length")).toBeLessThan(apply.indexOf("db.update("));
    expect(apply).toContain("because it would leave the page with a problem");
  });

  it("changes only the one box it was asked about, keeping the rest of a picture's details", () => {
    expect(body("copilotApplyUpdate")).toContain("{ [top]: next[top] }");
    expect(body("copilotApplyBatch")).toContain("{ [top]: next[top] }");     // image: { src, alt } is replaced whole, so src is kept
  });

  it("looks at each picture with the vision model when there is one, and says plainly when it could not", () => {
    expect(body("cpAlt")).toContain("WriterState.vision");
    expect(body("cpAlt")).toContain("await cpDescribe(t)");
    const describe1 = body("cpDescribe");
    expect(describe1).toContain("WriterState.vision ? await cpImageB64(t.src) : null");
    expect(describe1).toContain("guess: !image");
    expect(html).toContain("WriterState.vision = WriterLib.pickVision(r.models");
    expect(html).toContain("I could not see the picture. Please check it.");
  });

  it("needs no model to list what needs attention, using the same checks as the editor", () => {
    expect(body("cpAttentionRows")).toContain("errorsOf(col, r)");
    expect(body("cpAttention")).toContain("cpAttentionRows()");
    expect(html).toContain('if (intent.kind === "attention"){ cpAttention(); return; }');
  });

  it("can be resized by dragging or with the arrow keys, remembers the width, and stays within sensible limits", () => {
    expect(body("cpSetWidth")).toContain("Math.max(320, Math.min(max, Math.round(px)))");
    expect(body("cpSetWidth")).toContain("innerWidth * 0.7");
    expect(html).toContain('const CP_W_KEY = "ccs_copilot_width";');
    expect(html).toContain('role="separator" aria-orientation="vertical" tabindex="0"');
    expect(html).toContain('if (ev.key === "ArrowLeft"){ ev.preventDefault(); cpSetWidth(now + 32, true); }');
    expect(html).toContain('document.addEventListener("dblclick", (ev) => { if (ev.target.closest && ev.target.closest("[data-cp-resize]")) cpResetWidth(); });');
    expect(html).toContain("if (CopilotState.open){ const sw = cpSavedWidth(); if (sw) cpSetWidth(sw, false); else cpSetWidthAria(); }");
  });

  it("puts a Help me fix button on every problem and one for the whole list, and drafts fixes without saving", () => {
    expect(html).toContain('data-act="copilot-fix" data-col="');
    expect(html).toContain('data-act="copilot-fix-all"');
    expect(html).toContain("Help me fix these");
    for (const fn of ["cpFix", "cpFixMany"]) expect(body(fn)).not.toMatch(/db\.(add|update|remove)\(/);
    expect(body("cpFix")).toContain("CopilotLib.planFix(col, rec, errs)");
    expect(body("cpFix")).toContain("plan.manual.map(m => m.message)");           // what only a person can decide is handed back
    expect(body("cpFixMany")).toContain("rows.slice(0, 5)");                      // a handful at a time
  });

  it("applies a fix once, to the ticked boxes only, then says what still needs the person", () => {
    const apply = body("copilotApplyFix");
    expect(apply).toContain('m.card.state === "saved"');
    expect(apply).toContain("r.checked && String(r.value).trim()");
    expect(apply).toContain("c.data.left = errorsOf(d.col, next)");
    expect(apply).toContain("Nothing is ticked.");
  });

  it("turns a description, a video link or a page on the site into an archive entry draft with its email, never saving first", () => {
    const f = body("cpPortal");
    expect(f).not.toMatch(/db\.(add|update|remove)\(/);
    expect(f).toContain('WriterLib.taskMessages("draft"');
    expect(f).toContain("realTitle || d.title");                                   // a title that already exists is not renamed by the model
    expect(f).toContain('layout = "ebook"');
    expect(f).toContain('layout = "game"; source.gameId = rec.id');
    const save = body("copilotSave");
    expect(save).toContain('db.add("portalEntries"');
    expect(save.split('db.add("portalEntries"')[1].split("c.savedId = rec.id")[0]).toContain('status: "draft"');
    expect(html).toContain('{ id: "portal", label: "Add to the Subscriber’s Portal", icon: "mail-open" }');
  });

  it("shows a game on the site in the archive with a play button, whether it has a file or stored code", () => {
    expect(body("portalGameHTML")).toContain('data-act="open-game" data-id="');
    expect(body("portalGameHTML")).toContain('db.find("games", e.gameId)');
  });

  it("has a Writing helper in every content editor, which only fills in the form", () => {
    expect(html).toContain("    + ehCardHTML(col, rec)\n    + '<div class=\"admin-form-grid\">' + (FIELDS[col] || []).map(");
    expect(body("ehCardHTML")).toContain('col === "portalEntries" || !ehFields(col).length');   // the archive editor has its own, and an editor with no text boxes has none
    for (const fn of ["ehRun", "ehFix", "ehApply", "ehShowRows"]) expect(body(fn)).not.toMatch(/db\.(add|update|remove)\(|\.requestSubmit\(/);
    expect(html).toContain("This only fills in the form. Nothing is saved until you press Save.");
  });

  it("never writes in addresses, links or picture descriptions, or boxes that do not apply", () => {
    const skip = html.split("const EH_SKIP = ")[1].split(";\n")[0];
    for (const k of ["slug", "youtubeId", "youtubeUrl", "Url$", "Href$", "\\.alt$", "\\.src$"]) expect(skip).toContain(k);
    expect(body("ehFields")).toContain("only used when");
  });

  it("puts Help me fix in the red problem box of every editor", () => {
    expect(body("validationBox")).toContain('data-act="eh-fix"');
    expect(body("validationBox")).toContain("opts && opts.fix");
    expect((html.match(/validationBox\(problems, \{ fix: true \}\)/g) || []).length).toBe(2);       // the generic and the archive editor
    expect(html).toContain("validationBox(errs, { fix: true })");
    const fix = body("ehFix");
    expect(fix).toContain("CopilotLib.quickFixes(col, rec, errs)");
    expect(fix).toContain("checked: !q.risky");                                  // a decision starts unticked
    expect(fix).toContain("quick.advice[e.field] || e.message");
    expect(body("ehApply")).toContain("validationBox(left, { fix: true })");     // the box then says what is still wrong
  });

  it("suggests the next few words in every editor's text boxes, not only the archive's", () => {
    expect(body("writerOnInput")).toContain('form.getAttribute("data-act") !== "save-record"');
    expect(body("writerOnInput")).toContain("ehSuggestLabel(form.getAttribute(\"data-col\"), el.name)");
    expect(body("writerSuggest")).toContain("COLLECTION_LABELS[col]");
  });

  it("lists what it can do as one-tap starters", () => {
    for (const c of ["Add a YouTube video", "Add a game", "Write a newsletter", "Write a story", "Revise a page or my text", "Fix image descriptions", "Suggest tags", "What needs attention?"]) expect(html).toContain(c);
  });
});
