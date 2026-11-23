// The parent report's data (owner, 2026-11-23): the new optional answer fields and the per-day log behind the calendar.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/progress-days.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("supabase/progress-days.sql", () => {
  it("adds the answer fields as optional columns, safe to run again", () => {
    expect(sql).toContain("add column if not exists given text check (char_length(given) <= 200)");
    expect(sql).toContain("add column if not exists hints smallint not null default 0 check (hints between 0 and 20)");
    expect(sql).toContain("add column if not exists tries smallint not null default 1 check (tries between 1 and 50)");
    expect(sql).toContain("add column if not exists skill text check (char_length(skill) <= 80)");
  });
  it("keeps one row per child, day and item, and the days go with the child", () => {
    expect(sql).toContain("create table if not exists public.child_days (");
    expect(sql).toContain("child_id uuid not null references public.children(id) on delete cascade");
    expect(sql).toContain("kind text not null check (kind in ('episode', 'book', 'entry', 'activity', 'game'))");
    expect(sql).toContain("primary key (child_id, day, kind, item_id)");
  });
  it("is closed to the browser", () => {
    expect(sql).toContain("alter table public.child_days enable row level security;");
    expect(sql).toContain("revoke all on table public.child_days from public, anon, authenticated;");
    expect(sql).not.toMatch(/create policy|grant /i);
  });
});
