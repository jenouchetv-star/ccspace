// Prints the SQL that copies each book's questions from scripts/book-quiz.mjs into its record (stories.data.learn.quiz),
// where the reader reads them. Only the quiz is set; the rest of each book is left exactly as it is.
//   node scripts/sync-book-quiz.mjs > book-quiz.sql
import { BOOK_QUIZ } from "./book-quiz.mjs";

const out = [];
for (const [id, b] of Object.entries(BOOK_QUIZ)) {
  const quiz = { k1: b.k1, g23: b.g23, g45: b.g45 };
  const json = JSON.stringify(quiz);
  if (json.includes("$q$")) throw new Error("dollar quote clash in " + id);
  out.push("update public.stories set data = jsonb_set(data, '{learn,quiz}', $q$" + json + "$q$::jsonb) where id = '" + id + "' and data ? 'learn';");
}
console.log(out.join("\n"));
