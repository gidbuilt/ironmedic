-- IronMedic — Supabase Storage buckets
-- Photos and manual PDFs are blobs, not rows — they live in Storage, not
-- Postgres. Both buckets are private; access is gated by RLS policies on
-- storage.objects keyed off the object path convention "<user_id>/...".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('manuals', 'manuals', false, 52428800, array['application/pdf']),
  ('photos', 'photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Path convention enforced by the client: {user_id}/{machine_id}/{filename}
-- storage.foldername(name) splits the object path into an array of folders.

create policy "manuals_owner_select" on storage.objects
  for select using (
    bucket_id = 'manuals' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "manuals_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'manuals' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "manuals_owner_update" on storage.objects
  for update using (
    bucket_id = 'manuals' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "manuals_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'manuals' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "photos_owner_select" on storage.objects
  for select using (
    bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "photos_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "photos_owner_update" on storage.objects
  for update using (
    bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "photos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
