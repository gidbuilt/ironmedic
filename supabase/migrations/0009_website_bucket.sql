-- Public static website bucket for the IronMedic SPA (Vite build uploaded via
-- `npm run deploy:supabase` or `supabase storage cp`). Assets use relative
-- URLs so they resolve under this bucket's public object path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website',
  'website',
  true,
  52428800,
  array[
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'font/woff',
    'font/woff2',
    'application/octet-stream',
    'model/gltf-binary'
  ]
)
on conflict (id) do nothing;

-- Public read for the static site; writes go through the service role / dashboard.
create policy "website_public_select" on storage.objects
  for select using (bucket_id = 'website');
