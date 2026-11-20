-- Migração aditiva. Executar apenas após aprovação/configuração do projeto Supabase.
-- Nenhum dado do Elo é alterado. Sem seed de dados pessoais.
begin;
create function public.neo_valid_date(v text) returns boolean language plpgsql immutable set search_path=pg_catalog as $$
begin return v ~ '^\d{4}-\d{2}-\d{2}$' and to_char(v::date,'YYYY-MM-DD')=v and v::date between date '1900-01-01' and date '2200-12-31'; exception when others then return false; end $$;
create function public.neo_number(d jsonb,k text,lo numeric,hi numeric,optional boolean default false) returns boolean language plpgsql immutable set search_path=pg_catalog as $$
begin
 if not(d ? k) or d->k='null'::jsonb then return optional; end if;
 return jsonb_typeof(d->k)='number' and (d->>k)::numeric between lo and hi;
 exception when others then return false;
end $$;
create function public.neo_valid_record(k text,rid text,d jsonb) returns boolean language plpgsql stable set search_path=public,pg_catalog as $$
declare f text;
begin
 if jsonb_typeof(d)<>'object' or octet_length(d::text)>16000 or d->>'id' is distinct from rid or length(rid) not between 1 and 150 or rid !~ '^[-a-zA-Z0-9_:.]+$' or not neo_valid_date(d->>'date') then return false; end if;
 if k<>'reminders' and (d->>'date')::date>current_date+1 then return false; end if;
 if d ? 'note' and (jsonb_typeof(d->'note')<>'string' or length(d->>'note')>2000) then return false; end if;
 if k='weights' then return neo_number(d,'value',1,650) and neo_number(d,'fat',1,80,true);
 elsif k='measures' then
 if not neo_number(d,'waist',1,400) then return false;end if;
 foreach f in array array['hip','chest','arm','thigh'] loop if not neo_number(d,f,1,400,true) then return false;end if;end loop;
 return neo_number(d,'fat',1,80,true);
 elsif k='doses' then return neo_number(d,'amount',0.000001,100000) and d->>'unit' in ('mg','mcg','mL') and jsonb_typeof(d->'product')='string' and length(btrim(d->>'product')) between 1 and 80 and coalesce(length(d->>'site'),0)<=80 and coalesce(length(d->>'protocolId'),0)<=150;
 elsif k='journal' then return neo_number(d,'wellbeing',1,5,true) and neo_number(d,'energy',1,5,true) and neo_number(d,'appetite',1,5,true) and neo_number(d,'sleep',0,24,true) and neo_number(d,'water',0,15,true) and neo_number(d,'activity',0,1440,true);
 elsif k='protocols' then return jsonb_typeof(d->'name')='string' and length(btrim(d->>'name')) between 1 and 100 and d->>'status' in ('active','closed') and (coalesce(d->>'end','')='' or (neo_valid_date(d->>'end') and d->>'end'>=d->>'date'));
 elsif k='reminders' then return jsonb_typeof(d->'title')='string' and length(btrim(d->>'title')) between 1 and 100 and d->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and d->>'repeat' in ('once','daily','weekly') and neo_number(d,'weekday',0,6) and jsonb_typeof(d->'enabled')='boolean';
 end if;
 return false;
 exception when others then return false;
end $$;
create function public.neo_valid_profile(d jsonb) returns boolean language plpgsql stable set search_path=public,pg_catalog as $$
declare p jsonb;s jsonb;
begin
 p=d->'profile';s=d->'settings';
 return jsonb_typeof(d)='object' and octet_length(d::text)<12000 and jsonb_typeof(p)='object' and jsonb_typeof(s)='object' and jsonb_typeof(p->'name')='string' and length(btrim(p->>'name')) between 1 and 100 and p->>'theme' in ('system','light','dark') and p->>'units' in ('metric','imperial') and p->'consent'='true'::jsonb and neo_number(p,'height',40,260,true) and neo_number(p,'initialWeight',1,650,true) and neo_number(p,'goal',1,650,true) and (coalesce(p->>'birthDate','')='' or (neo_valid_date(p->>'birthDate') and (p->>'birthDate')::date<=current_date+1)) and s->>'weightTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and s->>'measureTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and s->>'measureDay' ~ '^[0-6]$' and jsonb_typeof(s->'enabled')='boolean';
 exception when others then return false;
end $$;
create table public.neo_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check(public.neo_valid_profile(data) is true),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table public.neo_records(
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('weights','measures','doses','journal','protocols','reminders')),
 id text not null,
 data jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key(user_id,kind,id),
 check(public.neo_valid_record(kind,id,data) is true)
);
create table public.neo_photos(
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 path text not null unique,
 date date not null check(date between date '1900-01-01' and current_date+1),
 role text not null default 'progress' check(role in ('progress','avatar')),
 created_at timestamptz not null default now(),
 check(path like user_id::text || '/%' and path !~ '\.\.' and length(path)<250)
);
create index neo_records_owner on public.neo_records(user_id,kind);
create index neo_photos_owner on public.neo_photos(user_id,date);
create function public.neo_bump_revision() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if new.user_id<>old.user_id then raise exception 'owner cannot change'; end if;
 new.revision=old.revision+1;new.updated_at=now();return new;
end $$;
create trigger neo_records_revision before update on public.neo_records for each row execute function public.neo_bump_revision();
create trigger neo_profiles_revision before update on public.neo_profiles for each row execute function public.neo_bump_revision();
alter table public.neo_profiles enable row level security;
alter table public.neo_records enable row level security;
alter table public.neo_photos enable row level security;
alter table public.neo_profiles force row level security;
alter table public.neo_records force row level security;
alter table public.neo_photos force row level security;
create policy neo_profile_owner on public.neo_profiles for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy neo_record_owner on public.neo_records for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and exists(select 1 from public.neo_profiles p where p.user_id=(select auth.uid())));
create policy neo_photo_owner on public.neo_photos for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and exists(select 1 from public.neo_profiles p where p.user_id=(select auth.uid())));
revoke all on public.neo_profiles, public.neo_records, public.neo_photos from anon;
grant select,insert,update,delete on public.neo_profiles, public.neo_records, public.neo_photos to authenticated;
-- Uma chamada = uma transação. IDs de importação são hashes de conteúdo, impedindo reenvio duplicado.
create function public.neo_import_records(p_rows jsonb) returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare r jsonb; added integer:=0;n integer;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>20000 or octet_length(p_rows::text)>20000000 then raise exception 'invalid import';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
 insert into public.neo_records(user_id,kind,id,data) values(auth.uid(),r->>'kind',r->>'id',r->'data') on conflict(user_id,kind,id) do nothing;
 get diagnostics n=row_count;added=added+n;
 end loop;
 return added;
end $$;
revoke all on function public.neo_import_records(jsonb) from public,anon;
grant execute on function public.neo_import_records(jsonb) to authenticated;
-- Bucket privado; sem política de leitura pública. Configurações aplicadas somente pelo responsável.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('neo-private','neo-private',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy neo_object_select on storage.objects for select to authenticated using(bucket_id='neo-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy neo_object_insert on storage.objects for insert to authenticated with check(bucket_id='neo-private' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.neo_profiles p where p.user_id=(select auth.uid())));
create policy neo_object_delete on storage.objects for delete to authenticated using(bucket_id='neo-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Sem UPDATE de objetos: fotos são imutáveis; substituições usam um novo nome.
commit;
