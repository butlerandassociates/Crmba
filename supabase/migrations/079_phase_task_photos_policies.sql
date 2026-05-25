-- Storage policies for phase-task-photos bucket
-- Bucket must already exist (created manually in Supabase Dashboard → Storage)

-- Allow authenticated users to upload photos
create policy "Authenticated users can upload phase task photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'phase-task-photos');

-- Allow authenticated users to overwrite/upsert photos (needed for upsert:true)
create policy "Authenticated users can update phase task photos"
on storage.objects for update to authenticated
using (bucket_id = 'phase-task-photos');

-- Allow anyone (public) to read photos — required because client portal has no auth
create policy "Public can view phase task photos"
on storage.objects for select to public
using (bucket_id = 'phase-task-photos');

-- Allow authenticated users to delete photos
create policy "Authenticated users can delete phase task photos"
on storage.objects for delete to authenticated
using (bucket_id = 'phase-task-photos');
