# Chike's Creative Space

This is the source for [chikescreativespace.com](https://www.chikescreativespace.com) — a kids' activities site (hands-on projects, games, stories, and videos) built as a single-file, no-build vanilla-JS app with a Supabase backend — maintained here for whoever is developing or operating the site.

## Where things live

- `index.html` — the entire public site and the admin portal (routing, views, and styles all in one file, no build step).
- `supabase/` — database schema/migrations and the Edge Functions the app calls (`supabase/functions/*`).
- `games/`, `books/` — standalone HTML games and story-reader pages, loaded in a sandboxed iframe from the main app.
- `MAINTENANCE.md` — the recurring post-launch checklist (run this monthly).

## Running it locally

```
python .claude/serve.py 4321
```

then open `http://localhost:4321`. There's no build step — edits to `index.html` show up on refresh.
