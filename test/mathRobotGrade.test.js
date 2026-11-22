// Grade adjust: Robo Math Buddy (subscribers only, opened as a sealed srcdoc) starts at the picked child's grade.
// The site sets window.CCS_GRADE before the game's scripts; the buddy teaches Kindergarten to 5th grade.
// The chat is run here for real: the start-up memory block plus the conversation functions, with the screen stubbed.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../supabase/private-games/math-robot.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");

/** One function of the game's main script, from its name to its closing brace at two-space indent. */
function fnText(name) {
  const start = html.indexOf("  function " + name + "(");
  return html.slice(start, html.indexOf("\n  }\n", start) + 4);
}
const startBlock = html.slice(html.indexOf("  const CCS_CHILD_GRADE"), html.indexOf("\n", html.indexOf("  var GRADES = ")) + 1);
const askMenu = html.slice(html.indexOf("  var ASK_MENU"), html.indexOf("\n", html.indexOf("  var ASK_MENU")) + 1);

/** Opens the buddy with this grade passed (undefined: none) and what this computer remembers; returns a chat to talk to. */
function openBuddy(grade, remembered = null) {
  const store = new Map(remembered ? [["robo-math-buddy", JSON.stringify(remembered)]] : []);
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const said = [];
  const code = startBlock + fnText("greeting") + fnText("cleanName") + fnText("readGrade") + askMenu + fnText("startChat") + fnText("respond")
    + "; return { mem: () => mem, state: () => state, respond, CHILD_GRADE };";
  const api = new Function("window", "location", "localStorage", "say", "mood", "showOnBoard", "scores", "askQuestion",
    code)(grade === undefined ? {} : { CCS_GRADE: grade }, { search: "" }, localStorage, (t) => said.push(t), () => {}, () => {}, () => {}, () => {});
  return { ...api, said, hear: (t) => api.respond(t, t.toLowerCase()) };
}

describe("Robo Math Buddy: the child's grade", () => {
  it("uses the child's grade: it asks the name, never the grade", () => {
    const b = openBuddy(2);
    expect(b.mem().grade).toBe(2);
    expect(b.state().phase).toBe("askName");
    b.hear("Maya");
    expect(b.mem().name).toBe("Maya");
    expect(b.mem().grade).toBe(2);
    expect(b.state().phase).toBe("chat");
    expect(b.said.at(-1)).toMatch(/^Nice to meet you, Maya! Good (morning|afternoon|evening), Maya!/);
    expect(b.said.join(" ")).not.toMatch(/What grade are you in/);
    // a returning kid whose name is remembered goes straight to the chat
    const back = openBuddy(4, { name: "Maya", grade: null });
    expect(back.state().phase).toBe("chat");
    expect(back.mem().grade).toBe(4);
    // the child's grade wins over one remembered on this computer
    expect(openBuddy(1, { name: "Maya", grade: 5 }).mem().grade).toBe(1);
    // Kindergarten is a grade, not "no grade"
    const k = openBuddy(0);
    k.hear("Bo");
    expect(k.mem().grade).toBe(0);
    expect(k.state().phase).toBe("chat");
  });

  it("clamps: a 6th grader plays 5th grade", () => {
    const b = openBuddy(6);
    expect(b.CHILD_GRADE).toBe(5);
    expect(b.mem().grade).toBe(5);
  });

  it("no grade: as today (it asks the name, then the grade)", () => {
    for (const bad of [undefined, 7, 2.5, "abc", ""]) {
      const b = openBuddy(bad);
      expect(b.mem().grade, String(bad)).toBeNull();
      expect(b.state().phase).toBe("askName");
      b.hear("Maya");
      expect(b.state().phase).toBe("askGrade");
      expect(b.said.at(-1)).toBe("Nice to meet you, Maya! What grade are you in? You can say Kindergarten, or 1st to 5th grade.");
      b.hear("3rd grade");
      expect(b.mem().grade).toBe(3);
      expect(b.state().phase).toBe("chat");
      expect(b.said.at(-1)).toMatch(/^3rd grade! Got it\. Good /);
    }
    // a remembered grade still counts when none is passed
    expect(openBuddy(undefined, { name: "Maya", grade: 1 }).state().phase).toBe("chat");
    expect(openBuddy(undefined, { name: "Maya", grade: null }).state().phase).toBe("askGrade");
  });

  it("change still works: \"grade 3\" in the chat changes it", () => {
    const b = openBuddy(1);
    b.hear("Maya");
    b.hear("I'm in grade 3");
    expect(b.mem().grade).toBe(3);
    expect(b.said.at(-1)).toMatch(/^Got it, 3rd grade!/);
  });

  it("Clear memory keeps the child's grade", () => {
    expect(html).toContain('mem = { name:"", grade:CHILD_GRADE, botName:"", right:0, highFives:0 };');
  });
});
