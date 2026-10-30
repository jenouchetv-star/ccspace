-- The 6-digit code that can be typed instead of tapping the emailed link (the Gravity 4 Join modal asks for one).
-- Run once in the Supabase SQL Editor (safe to run again). It only adds a counter of wrong guesses, so a code can
-- lock after a few tries. The same line is in newsletter-portal.sql and migration.sql for a fresh project.
alter table portal_tokens add column if not exists tries int not null default 0;
