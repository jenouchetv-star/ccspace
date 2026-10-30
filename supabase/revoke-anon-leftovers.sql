-- Anonymous visitors had leftover table permissions on five admin-only tables. Row level security already refused
-- every request (none of them has a policy for anon), but the grants themselves are removed so a mistake in a
-- policy later can never open them up. The site only reads these tables once an admin is signed in.
-- Applied to the live project on 2026-10-30 as migration revoke_anon_leftover_grants. Safe to run again.
revoke all on table public.blocked_senders, public.moderation_settings, public.moderation_terms, public.newsletters, public.profiles from anon;
