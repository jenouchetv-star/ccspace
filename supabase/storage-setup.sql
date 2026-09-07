-- Chike's Creative Space - Supabase Storage setup for real file uploads
-- (games, cover photos, printable PDFs) from the admin portal.
--
-- Run this once in the Supabase SQL Editor (Project: wdctkfhwygwwulipwnys),
-- the same way migration.sql was run - the anon key cannot create a bucket
-- or storage policy on its own (confirmed: a REST attempt to create a
-- bucket with the anon key returns 403 "new row violates row-level
-- security policy"), so this has to happen with the SQL Editor's elevated
-- access.
--
-- One public bucket, "uploads", holding everything an admin uploads
-- through the portal (games/*.html, media/*.{jpg,png,webp}, printables/*.pdf
-- - the folder is just a path prefix inside the one bucket, not a separate
-- bucket per type). Same permissive, zero-auth posture as every table in
-- migration.sql: anon can read AND write. Revisit before any real public
-- launch, exactly like that file's own risk note.

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

drop policy if exists "anon full access" on storage.objects;
create policy "anon full access" on storage.objects for all to anon
  using (bucket_id = 'uploads') with check (bucket_id = 'uploads');

-- Confirm the bucket exists and is public before wiring up uploads.
select id, name, public from storage.buckets where id = 'uploads';
