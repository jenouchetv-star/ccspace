-- Play on your TV, part 2 (owner, 2026-11-26: "start part 2, skip Chromecast for now").
-- A TV opens chikescreativespace.com/tv and shows a short code. A subscriber's phone (or a signed-in admin) types
-- the code and picks a TV-ready game; the TV then gets that one game's code, once. Nobody signs in on the TV.
-- Only the tv-link Edge Function (service role) reads or writes this table: RLS is on and there are no policies.
create table if not exists public.tv_links (
  code        text primary key,                 -- the 4 letters on the TV screen
  secret_hash text not null,                    -- SHA-256 of the TV's own secret, so only that TV can collect the game
  ip_hash     text not null default '',         -- SHA-256 of the TV's IP, for a per-IP limit on new codes
  game_id     text,                             -- portal_game_files id, set when a phone pairs
  title       text,
  paired_by   text,                             -- subscriber id, or admin:<user id>
  paired_at   timestamptz,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists tv_links_expires_idx on public.tv_links (expires_at);
create index if not exists tv_links_ip_idx on public.tv_links (ip_hash, created_at);
alter table public.tv_links enable row level security;
revoke all on public.tv_links from anon, authenticated;
