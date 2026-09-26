// The flow that completes the thing this product exists to do: a visitor
// answers a few questions in the Activity Finder, and gets back a real
// result - three matching activities, ranked, with reasons. This tests
// the exact matching engine the live site imports (assets/lib/
// activityFinder.js), not a copy of it, through its public exports only
// (scoreFind, findTopMatches) - never anything internal to how it's
// implemented. No backend, no DOM: activities are plain fixture objects,
// same shape as a real published record in the app's own database.
import { describe, it, expect } from "vitest";
import { scoreFind, findTopMatches, findBands } from "../assets/lib/activityFinder.js";

function activity(overrides) {
  return Object.assign(
    {
      id: "a0",
      character: "zech",
      themes: ["fly"],
      materials: ["paper"],
      mins: 10,
      plus: false,
      ageMin: 5,
      ageMax: 8,
      place: "either",
      support: "kid",
      challenge: "easy",
      topic: "weather",
      access: "free",
    },
    overrides
  );
}

describe("findBands", () => {
  it("puts a short activity in the quick band", () => {
    expect(findBands(activity({ mins: 8 }))).toContain("quick");
  });

  it("puts a long, or an extended (plus), activity in the big band", () => {
    expect(findBands(activity({ mins: 45 }))).toContain("big");
    expect(findBands(activity({ mins: 12, plus: true }))).toContain("big");
  });
});

describe("scoreFind", () => {
  it("scores higher the more of the visitor's answers an activity matches", () => {
    const a = activity({ materials: ["paper", "connect"], themes: ["fly"] });
    const noMatch = scoreFind(a, {});
    const materialMatch = scoreFind(a, { materials: ["paper"] });
    const fullMatch = scoreFind(a, { materials: ["paper", "connect"], theme: "fly", time: "quick" });
    expect(materialMatch.score).toBeGreaterThan(noMatch.score);
    expect(fullMatch.score).toBeGreaterThan(materialMatch.score);
  });

  it("never sends a grown-up-hands-on activity to a 3-5 year old", () => {
    const a = activity({ support: "hands-on", ageMin: 3, ageMax: 10 });
    const result = scoreFind(a, { age: "3-5" });
    expect(result.gaps).toContain("A grown-up needs to be hands-on for this one");
  });

  it("explains a character match by name, using whatever lookup is supplied", () => {
    const a = activity({ character: "zech" });
    const result = scoreFind(a, { character: "zech" }, { charName: (id) => "Zech the Builder" });
    expect(result.why).toContain("One of Zech the Builder’s");
  });
});

describe("findTopMatches", () => {
  it("returns the three best-scoring activities, ranked highest first", () => {
    const best = activity({ id: "best", materials: ["paper"], themes: ["fly"] });
    const middle = activity({ id: "middle", materials: ["paper"] });
    const worst = activity({ id: "worst", materials: ["boxes"], themes: ["build"] });
    const filters = { materials: ["paper"], theme: "fly" };
    const results = findTopMatches([worst, best, middle], filters);
    expect(results.map((r) => r.activity.id)).toEqual(["best", "middle", "worst"]);
  });

  it("caps any one character at two of the three results", () => {
    const activities = [
      activity({ id: "z1", character: "zech", materials: ["paper"] }),
      activity({ id: "z2", character: "zech", materials: ["paper"] }),
      activity({ id: "z3", character: "zech", materials: ["paper"] }),
      activity({ id: "c1", character: "chike", materials: ["boxes"] }),
    ];
    const results = findTopMatches(activities, { materials: ["paper"] });
    const byCharacter = results.reduce((counts, r) => {
      counts[r.activity.character] = (counts[r.activity.character] || 0) + 1;
      return counts;
    }, {});
    expect(byCharacter.zech).toBeLessThanOrEqual(2);
    expect(results).toHaveLength(3);
  });
});
