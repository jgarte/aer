insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'rate-cache',
  'rate-cache',
  false,
  array['application/json']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;
