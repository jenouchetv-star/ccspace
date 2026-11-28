// The free math games send their answers to the progress report (owner, 2026-11-28: "start with step 1" of the
// tracker coverage draft, docs/mockups/tracker-coverage-draft.png).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { answerFromMessage } from "../assets/lib/progress.js";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const body = (src, name) => src.split("function " + name + "(")[1].split("\n}\n")[0] + "\n}";
const bodyIndented = (src, name) => src.split("function " + name + "(")[1].split("\n        }\n")[0] + "\n}";
const site = read("index.html");

describe("Balloon Pop Math sends each question's answer", () => {
  const src = read("games/balloon-pop-math.html");
  const run = (state) => {
    const sent = [];
    const win = { parent: { postMessage: (m) => sent.push(m) } };
    const fn = new Function("window", "grade", "cur", "misses", "workShown", "firstWrong", "fmt",
      "function mathSkill(" + body(src, "mathSkill").slice(0) + "\nreturn function sendAnswer(" + body(src, "sendAnswer"))(
      win, state.grade, state.cur, state.misses, state.workShown, state.firstWrong, (n) => Number(n).toLocaleString("en-US"));
    fn();
    return sent;
  };

  it("right the first time: correct, math, at the grade's level, with the skill", () => {
    const [m] = run({ grade: { id: "2" }, cur: { q: "45 + 27", a: 72, say: "45 + 27 = 72" }, misses: 0, workShown: false, firstWrong: "" });
    const a = answerFromMessage(m);
    expect(a).toMatchObject({ game: "balloon-pop-math", subject: "math", level: "g23", correct: true, question: "What is 45 + 27?", answer: "72", why: "45 + 27 = 72", skill: "Adding", tries: 1 });
    expect(a.qid).toMatch(/^bpm-[a-z0-9]+$/);
  });

  it("after a miss or Show me how: not correct, with the tries, the hint and the first wrong answer", () => {
    const [m] = run({ grade: { id: "k" }, cur: { q: 'How many stars? <span class="stars">★★★★</span>', a: 4, say: "There are 4 stars.", html: true }, misses: 2, workShown: true, firstWrong: "5" });
    const a = answerFromMessage(m);
    expect(a).toMatchObject({ level: "k1", correct: false, tries: 3, hints: 1, given: "5", skill: "Counting" });
    expect(a.question).toBe("How many stars? ★★★★");
  });

  it("names the skill: patterns and story problems too", () => {
    const skill = (q) => run({ grade: { id: "2" }, cur: { q, a: 1, say: "x" }, misses: 0, workShown: false, firstWrong: "" })[0].ccsAnswer.skill;
    expect(skill("What is missing? 16, 18, __, 22, 24")).toBe("Number patterns");
    expect(skill("Mateo has 46 stickers and gets 21 more. How many now?")).toBe("Word problems");
    expect(skill("12 − 5")).toBe("Taking away");
    expect(skill("6 × 7")).toBe("Multiplying");
  });

  it("the same question always has the same id; 4th and 5th are g45", () => {
    const one = run({ grade: { id: "5" }, cur: { q: "144 ÷ 12", a: 12, say: "144 ÷ 12 = 12" }, misses: 0, workShown: false, firstWrong: "" });
    const two = run({ grade: { id: "5" }, cur: { q: "144 ÷ 12", a: 12, say: "144 ÷ 12 = 12" }, misses: 1, workShown: false, firstWrong: "11" });
    expect(one[0].ccsAnswer.qid).toBe(two[0].ccsAnswer.qid);
    expect(one[0].ccsAnswer).toMatchObject({ level: "g45", skill: "Dividing" });
  });

  it("is sent when the right balloon pops, and the wrong ones and Show me how are noted first", () => {
    expect(src).toContain("  sendAnswer();\n  if (!misses){ firstTries++;");
    expect(src).toContain('  if (!firstWrong) firstWrong = fmt(Number(el.dataset.n));');
    expect(src).toContain("  workShown = true;");
    expect(src).toContain('  misses = 0; busy = false; firstWrong = ""; workShown = false; hideWork();');
  });
});

describe("Maze Quest sends each wizard answer", () => {
  const src = read("games/maze-quest.html");
  const run = (picked, chosen, gradeIndex) => {
    const sent = [];
    const win = { parent: { postMessage: (m) => sent.push(m) } };
    const GRADE_LIST = [{ id: "k" }, { id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }];
    new Function("window", "GRADE_LIST", "gradeIndex",
      "function mazeSkill(" + bodyIndented(src, "mazeSkill") + "\nreturn function sendQuizAnswer(" + bodyIndented(src, "sendQuizAnswer"))(
      win, GRADE_LIST, gradeIndex)(picked, chosen);
    return sent;
  };

  it("a math question counts toward Math", () => {
    const [m] = run({ kind: "math", q: "What is 6 × 7?", options: ["42", "48", "36"], answer: 0 }, 0, 3);
    expect(answerFromMessage(m)).toMatchObject({ game: "maze-quest", subject: "math", level: "g23", correct: true, answer: "42", skill: "Multiplying", why: "The answer is 42." });
  });

  it("a spelling clue counts toward Reading and Writing, with what was picked when it was wrong", () => {
    const [m] = run({ kind: "spell", q: "Clue: a place to sleep. Which spelling is right?", options: ["bed", "bedd"], answer: 0 }, 1, 0);
    const a = answerFromMessage(m);
    expect(a).toMatchObject({ subject: "reading", level: "k1", correct: false, given: "bedd", answer: "bed", why: "Bed is spelled B-E-D." });
    expect(a.qid).toMatch(/^mqs-[a-z0-9]+$/);
  });

  it("is sent as soon as an answer is picked", () => {
    expect(src).toContain("            quizPicked = picked;");
    expect(src).toContain("            buttons.forEach(b => b.disabled = true);\n            sendQuizAnswer(quizPicked, chosenIndex);");
  });
});

describe("their pages say what they count toward", () => {
  it("Balloon Pop Math counts toward Math; Maze Quest toward Math and Reading", () => {
    expect(site).toContain('"game-balloon-math": ["math"], "game-maze": ["math", "reading"],');
  });
});

describe("the family account games send their answers too (owner, 2026-11-28: step 2)", () => {
  const post = () => { const sent = []; return { sent, win: { postMessage: (m) => sent.push(m) } }; };

  it("Math Runner: the best door is the right answer", () => {
    const src = read("supabase/private-games/number-dash.html");
    const fns = ["doorLabel", "applyDoor", "formatCoins"].map((n) => "function " + n + "(" + src.split("function " + n + "(")[1].split("\n}")[0] + "\n}").join("\n");
    const { sent, win } = post();
    const send = new Function("parent", "window", "Game", fns + "\nreturn function sendDoorAnswer(" + body(src, "sendDoorAnswer"))(win, {}, { level: "g3" });
    const doors = [{ op: "+", n: 8 }, { op: "×", n: 3 }, { op: "−", n: 5 }];
    send(10n, doors, 0, [1]);
    const a = answerFromMessage(sent[0]);
    expect(a).toMatchObject({ game: "math-runner", subject: "math", level: "g23", correct: false, answer: "×3", given: "+8 (18 coins)", skill: "Multiplying" });
    expect(a.question).toBe("You have 10 coins. Which door gives you the most: +8, ×3, −5?");
    expect(a.why).toBe("Through ×3 you have 30 coins, the most.");
    expect(src).toContain("  sendDoorAnswer(before, doors, lane, best);");
  });

  it("Robo Math Buddy: its quiz questions, not the child's own homework", () => {
    const src = read("supabase/private-games/math-robot.html");
    const fn = src.split("  function sendQuizAnswer(")[1].split("\n  }\n")[0];
    const { sent, win } = post();
    win.parent = { postMessage: win.postMessage };
    const send = new Function("window", "mem", "answerText", "fmt", "return function sendQuizAnswer(" + fn + "\n}")(
      win, { grade: 4 }, (q) => String(q.answer), (n) => String(n));
    send({ text: "6 × 7", answer: 42, steps: ["6 × 7 = ?", "6 × 7 = 42"] }, false, 48);
    expect(answerFromMessage(sent[0])).toMatchObject({ game: "robo-math-buddy", level: "g45", correct: false, question: "What is 6 × 7?", answer: "42", given: "48", why: "6 × 7 = 42", skill: "Multiplying" });
    expect(src).toContain("        sendQuizAnswer(state.q, right, n);");
  });

  it("Remote Lunar: building questions count toward Engineering, the rest Science", () => {
    const src = read("supabase/private-games/remote-lunar-salvage.html");
    const { sent, win } = post();
    win.parent = { postMessage: win.postMessage };
    const send = new Function("window", "G", "QZ", "gradeBand", "curGrade", "return function sendQuizAnswer(" + body(src, "sendQuizAnswer"))(
      win, { world: { id: "pumice" } }, { i: 2 }, () => "g1", () => 1);
    send({ q: "Which shape keeps the bridge strong?", opts: [{ t: "triangle" }, { t: "square" }], a: 0, why: "The triangle." }, 1);
    send({ q: "Where does a ball fall more slowly?", opts: [{ t: "Pumice Moon" }, { t: "Earth" }], a: 0, why: "On Pumice Moon." }, 0);
    expect(answerFromMessage(sent[0])).toMatchObject({ game: "remote-lunar", qid: "rl-pumice-g1-2", subject: "engineering", level: "k1", correct: false, given: "square" });
    expect(answerFromMessage(sent[1])).toMatchObject({ subject: "science", correct: true, answer: "Pumice Moon" });
    expect(src).toContain("  sendQuizAnswer(q, k);");
  });

  it("their pages say what they count toward", () => {
    expect(site).toContain('"game-math-runner": ["math"], "game-robo-math-buddy": ["math"], "game-remote-lunar-salvage": ["science", "engineering"] };');
  });
});
