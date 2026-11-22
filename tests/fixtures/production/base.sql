create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage; create schema vault; create schema cron;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create table cron.job(jobid integer primary key,jobname text,schedule text,active boolean,command text);
insert into cron.job values(1,'neo-push-dispatch','* * * * *',true,'select 1');
create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz,
deleted_at timestamptz,is_anonymous boolean,raw_app_meta_data jsonb,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,storage to authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,name text,bucket_id text,metadata jsonb);
alter table storage.objects enable row level security;
grant select,insert,delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
