// Prints the SQL that copies each episode's and activity's quick questions from scripts/item-quiz.mjs into its record
// (videos.data.quiz, activities.data.quiz), where the site reads them (owner, 2026-11-24). Only quiz is set; the rest of
// each record is left exactly as it is. Run it only after the owner approves the questions
// (docs/mockups/item-quiz-review.html).
//   node scripts/sync-item-quiz.mjs > item-quiz.sql
import { ITEM_QUIZ } from "./item-quiz.mjs";

const TABLE = { episode: "videos", activity: "activities" };
export function itemQuizSql(all) {
  const out = [];
  for (const [key, it] of Object.entries(all)) {
    const [kind, id] = key.split(":");
    if (!TABLE[kind] || !/^[A-Za-z0-9_-]{1,64}$/.test(id || "")) throw new Error("bad key " + key);
    const json = JSON.stringify({ subject: it.subject, k1: it.k1, g23: it.g23, g45: it.g45 });
    if (json.includes("$q$")) throw new Error("dollar quote clash in " + key);
    out.push("update public." + TABLE[kind] + " set data = data || jsonb_build_object('quiz', $q$" + json + "$q$::jsonb) where id = '" + id + "';");
  }
  return out.join("\n");
}
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/sync-item-quiz.mjs")) console.log(itemQuizSql(ITEM_QUIZ));
