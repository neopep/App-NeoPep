create role service_role;
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key, created_at timestamptz default now(),
  raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid, name text, bucket_id text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
create schema vault;
create table vault.decrypted_secrets(name text, decrypted_secret text);
