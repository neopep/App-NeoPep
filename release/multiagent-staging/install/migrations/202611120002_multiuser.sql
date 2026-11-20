-- Etapa 2: migração ADITIVA; aplicar depois da 001 em projeto de teste aprovado.
begin;
create schema if not exists neo_private;
revoke all on schema neo_private from public,anon,authenticated;
create table neo_private.admin_members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now()
);
create table neo_private.activity(
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen timestamptz not null default now()
);
create table neo_private.rate_limits(
 user_id uuid not null references auth.users(id) on delete cascade,
 action text not null,window_start timestamptz not null,hits integer not null default 1,
 primary key(user_id,action,window_start)
);
create table neo_private.app_errors(
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null default current_date,code text not null check(code in ('sync_failed','photo_failed','profile_failed','import_failed')),
 count integer not null default 1,primary key(user_id,day,code)
);
alter table neo_private.admin_members enable row level security;
alter table neo_private.activity enable row level security;
alter table neo_private.rate_limits enable row level security;
alter table neo_private.app_errors enable row level security;
revoke all on all tables in schema neo_private from public,anon,authenticated;
create table public.neo_consents(
 user_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null check(purpose in ('health','terms','photos')),
 version text not null default '2026-11-v1' check(version='2026-11-v1'),
 granted boolean not null,
 changed_at timestamptz not null default now(),
 primary key(user_id,purpose,version)
);
create table public.neo_migration_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 migration_id text not null check(migration_id ~ '^[a-f0-9]{64}$'),
 manifest jsonb not null check(jsonb_typeof(manifest)='array' and octet_length(manifest::text)<=3000000),
 records_requested integer not null check(records_requested between 0 and 20000),
 completed_at timestamptz not null default now(),
 primary key(user_id,migration_id)
);
alter table public.neo_consents enable row level security;
alter table public.neo_consents force row level security;
alter table public.neo_migration_receipts enable row level security;
alter table public.neo_migration_receipts force row level security;
create policy neo_consent_read on public.neo_consents for select to authenticated using(user_id=(select auth.uid()));
create policy neo_receipt_read on public.neo_migration_receipts for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.neo_consents,public.neo_migration_receipts from public,anon,authenticated;
grant select on public.neo_consents,public.neo_migration_receipts to authenticated;

-- Comprovantes de consentimento: histórico do próprio titular, sem dados corporais.
create table public.neo_consent_events(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null,version text not null,granted boolean not null,
 changed_at timestamptz not null default now()
);
alter table public.neo_consent_events enable row level security;
alter table public.neo_consent_events force row level security;
revoke all on public.neo_consent_events from public,anon,authenticated;
grant select on public.neo_consent_events to authenticated;
create policy neo_consent_event_read on public.neo_consent_events for select to authenticated using(user_id=(select auth.uid()));
create function neo_private.audit_consent() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if TG_OP='INSERT' or new.granted is distinct from old.granted then
 insert into public.neo_consent_events(user_id,purpose,version,granted) values(new.user_id,new.purpose,new.version,new.granted);
 end if;return new;
end $$;
create trigger neo_consent_event after insert or update on public.neo_consents for each row execute function neo_private.audit_consent();

create function neo_private.take_limit(a text,max_hits integer,seconds integer) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare n integer;w timestamptz;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 w=to_timestamp(floor(extract(epoch from clock_timestamp())/seconds)*seconds);
 insert into neo_private.rate_limits(user_id,action,window_start,hits) values(auth.uid(),a,w,1)
 on conflict(user_id,action,window_start) do update set hits=neo_private.rate_limits.hits+1 where neo_private.rate_limits.hits<max_hits returning hits into n;
 return n is not null;
end $$;
create function public.neo_has_consent(p_purpose text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.neo_consents where user_id=auth.uid() and purpose=p_purpose and version='2026-11-v1' and granted);
$$;
create function public.neo_set_consent(p_purpose text,p_granted boolean) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 if p_purpose not in ('health','terms','photos') or p_purpose is null or p_granted is null then raise exception 'invalid consent';end if;
 if not neo_private.take_limit('consent',20,3600) then raise exception 'too many requests' using errcode='P0001';end if;
 insert into public.neo_consents(user_id,purpose,version,granted) values(auth.uid(),p_purpose,'2026-11-v1',p_granted)
 on conflict(user_id,purpose,version) do update set granted=excluded.granted,changed_at=now();
end $$;
create function public.neo_complete_onboarding(p_profile jsonb,p_settings jsonb,p_health boolean,p_terms boolean) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare d jsonb;k text;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 if p_health is distinct from true or p_terms is distinct from true then raise exception 'explicit consent required';end if;
 if not neo_private.take_limit('onboarding',12,3600) then raise exception 'too many requests';end if;
 if not public.neo_number(p_profile,'height',40,260) or not public.neo_number(p_profile,'initialWeight',1,650) or not public.neo_number(p_profile,'goal',1,650) then raise exception 'initial profile incomplete';end if;
 if jsonb_typeof(p_profile->'tracking') is distinct from 'object' then raise exception 'tracking preferences required';end if;
 foreach k in array array['weight','measures','journal','photos','applications'] loop
  if jsonb_typeof(p_profile->'tracking'->k) is distinct from 'boolean' then raise exception 'invalid tracking preference';end if;
 end loop;
 d=jsonb_build_object('profile',p_profile,'settings',p_settings);
 if public.neo_valid_profile(d) is distinct from true then raise exception 'invalid profile';end if;
 insert into public.neo_consents(user_id,purpose,granted) values(auth.uid(),'health',true),(auth.uid(),'terms',true)
 on conflict(user_id,purpose,version) do update set granted=true,changed_at=now();
 insert into public.neo_profiles(user_id,data) values(auth.uid(),d) on conflict(user_id) do update set data=excluded.data;
end $$;
-- Regras consultam consentimento no servidor. Manipular localStorage/user_metadata não concede acesso.
drop policy neo_record_owner on public.neo_records;
create policy neo_record_select on public.neo_records for select to authenticated using((select auth.uid())=user_id);
create policy neo_record_delete on public.neo_records for delete to authenticated using((select auth.uid())=user_id);
create policy neo_record_insert on public.neo_records for insert to authenticated with check((select auth.uid())=user_id and public.neo_has_consent('health') and public.neo_has_consent('terms') and exists(select 1 from public.neo_profiles p where p.user_id=(select auth.uid())));
create policy neo_record_update on public.neo_records for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and public.neo_has_consent('health') and public.neo_has_consent('terms'));
drop policy neo_profile_owner on public.neo_profiles;
create policy neo_profile_read on public.neo_profiles for select to authenticated using((select auth.uid())=user_id);
create policy neo_profile_write on public.neo_profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and public.neo_has_consent('health') and public.neo_has_consent('terms'));
-- Inserção de perfil somente pela transação de onboarding; usuário pode excluir via função de conta.
revoke insert,delete on public.neo_profiles from authenticated;
drop policy neo_photo_owner on public.neo_photos;
create policy neo_photo_read on public.neo_photos for select to authenticated using((select auth.uid())=user_id);
create policy neo_photo_delete on public.neo_photos for delete to authenticated using((select auth.uid())=user_id);
create policy neo_photo_insert on public.neo_photos for insert to authenticated with check((select auth.uid())=user_id and public.neo_has_consent('health') and public.neo_has_consent('photos') and public.neo_has_consent('terms'));
revoke update on public.neo_photos from authenticated;
drop policy neo_object_insert on storage.objects;
create policy neo_object_insert on storage.objects for insert to authenticated with check(bucket_id='neo-private' and (storage.foldername(name))[1]=(select auth.uid())::text and public.neo_has_consent('health') and public.neo_has_consent('photos') and public.neo_has_consent('terms'));

create function public.neo_limit_writes() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is not null and not neo_private.take_limit('write',300,60) then raise exception 'write limit exceeded';end if;
 return null;
end $$;
create trigger neo_record_limits before insert or update on public.neo_records for each statement execute function public.neo_limit_writes();
create trigger neo_profile_limits before update on public.neo_profiles for each statement execute function public.neo_limit_writes();
create trigger neo_photo_limits before insert on public.neo_photos for each statement execute function public.neo_limit_writes();

-- Importação com confirmação verificável, idempotente, transacional e sem apagar a origem local.
create function public.neo_migrate_records(p_rows jsonb,p_migration_id text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb;existing jsonb;n integer:=0;requested integer;manifest jsonb;
begin
 if auth.uid() is null or not public.neo_has_consent('health') or not public.neo_has_consent('terms') then raise exception 'authentication and consent required' using errcode='42501';end if;
 if not exists(select 1 from public.neo_profiles where user_id=auth.uid()) then raise exception 'onboarding required';end if;
 if p_migration_id is null or p_migration_id !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>20000 or octet_length(p_rows::text)>20000000 then raise exception 'invalid import';end if;
 if (select count(*) from (select distinct x->>'kind',x->>'id' from jsonb_array_elements(p_rows) x) d)<>jsonb_array_length(p_rows) then raise exception 'duplicate import ids';end if;
 if not neo_private.take_limit('migration',6,3600) then raise exception 'migration limit exceeded';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 for r in select value from jsonb_array_elements(p_rows) loop
  if public.neo_valid_record(r->>'kind',r->>'id',r->'data') is distinct from true then raise exception 'invalid record';end if;
  select data into existing from public.neo_records where user_id=auth.uid() and kind=r->>'kind' and id=r->>'id';
  if found then if existing is distinct from r->'data' then raise exception 'import id conflict';end if;
  end if;
 end loop;
 insert into public.neo_records(user_id,kind,id,data) select auth.uid(),x->>'kind',x->>'id',x->'data' from jsonb_array_elements(p_rows) x on conflict(user_id,kind,id) do nothing;
 get diagnostics n=row_count;
 requested=jsonb_array_length(p_rows);
 select coalesce(jsonb_agg(jsonb_build_object('kind',x->>'kind','id',x->>'id') order by x->>'kind',x->>'id'),'[]'::jsonb) into manifest from jsonb_array_elements(p_rows) x;
 select receipt.manifest into existing from public.neo_migration_receipts receipt where user_id=auth.uid() and migration_id=p_migration_id;
 if found and existing is distinct from manifest then raise exception 'migration receipt conflict';end if;
 insert into public.neo_migration_receipts(user_id,migration_id,manifest,records_requested) values(auth.uid(),p_migration_id,manifest,requested) on conflict(user_id,migration_id) do nothing;
 return jsonb_build_object('migration_id',p_migration_id,'verified',requested,'added',n);
end $$;
-- Retirar o RPC legado da superfície de escrita. A função continua no histórico de migrações.
revoke execute on function public.neo_import_records(jsonb) from authenticated;

create function public.neo_heartbeat() returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 insert into neo_private.activity(user_id,last_seen) values(auth.uid(),now()) on conflict(user_id) do update set last_seen=now() where neo_private.activity.last_seen<now()-interval '5 minutes';
end $$;
create function public.neo_report_error(p_code text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_code not in ('sync_failed','photo_failed','profile_failed','import_failed') or p_code is null then raise exception 'invalid error code';end if;
 if not neo_private.take_limit('error_report',20,3600) then return;end if;
 insert into neo_private.app_errors(user_id,day,code,count) values(auth.uid(),current_date,p_code,1) on conflict(user_id,day,code) do update set count=neo_private.app_errors.count+1;
end $$;
create function public.neo_admin_access() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from neo_private.admin_members where user_id=auth.uid());
$$;
create function public.neo_admin_summary() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare daily jsonb;errors jsonb;
begin
 if auth.uid() is null or not public.neo_admin_access() then raise exception 'administrator required' using errcode='42501';end if;
 if not neo_private.take_limit('admin_summary',30,60) then raise exception 'admin rate limit exceeded';end if;
 select coalesce(jsonb_agg(jsonb_build_object('day',day,'count',case when n<5 then null else n end) order by day),'[]'::jsonb) into daily from(select created_at::date as day,count(*) as n from auth.users where created_at>=current_date-interval '14 days' group by created_at::date)t;
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'count',n)),'[]'::jsonb) into errors from(select code,sum(count) n from neo_private.app_errors where day>=current_date-7 group by code)t;
 return jsonb_build_object('users_total',(select count(*) from auth.users),'signups_7d',(select count(*) from auth.users where created_at>=now()-interval '7 days'),'active_24h',(select count(*) from neo_private.activity where last_seen>=now()-interval '24 hours'),'active_7d',(select count(*) from neo_private.activity where last_seen>=now()-interval '7 days'),'active_30d',(select count(*) from neo_private.activity where last_seen>=now()-interval '30 days'),'profiles_total',(select count(*) from public.neo_profiles),'records_total',(select count(*) from public.neo_records),'photos_total',(select count(*) from public.neo_photos),'signups_daily',daily,'app_errors_7d',errors,'server_time',now(),'database_status','reachable','private_storage',(select not public from storage.buckets where id='neo-private'),'schema_version','202611120002','health_data_exposed',false);
end $$;

create function public.neo_export_account_metadata() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 if not neo_private.take_limit('export',12,3600) then raise exception 'export limit exceeded';end if;
 return jsonb_build_object('consents',coalesce((select jsonb_agg(to_jsonb(c)-'user_id') from public.neo_consents c where user_id=auth.uid()),'[]'::jsonb),'consent_history',coalesce((select jsonb_agg(to_jsonb(c)-'user_id' order by c.id) from public.neo_consent_events c where user_id=auth.uid()),'[]'::jsonb),'migration_receipts',coalesce((select jsonb_agg(to_jsonb(c)-'user_id') from public.neo_migration_receipts c where user_id=auth.uid()),'[]'::jsonb),'photos_metadata',coalesce((select jsonb_agg(to_jsonb(p)-'user_id') from public.neo_photos p where user_id=auth.uid()),'[]'::jsonb),'activity',(select jsonb_build_object('last_seen',last_seen) from neo_private.activity where user_id=auth.uid()),'operational_errors',coalesce((select jsonb_agg(jsonb_build_object('day',day,'code',code,'count',count)) from neo_private.app_errors where user_id=auth.uid()),'[]'::jsonb));
end $$;
-- Privilégios explícitos: nenhuma função administrativa concede privilégios a contas comuns.
revoke all on all functions in schema neo_private from public,anon,authenticated;
revoke all on function public.neo_has_consent(text),public.neo_set_consent(text,boolean),public.neo_complete_onboarding(jsonb,jsonb,boolean,boolean),public.neo_migrate_records(jsonb,text),public.neo_heartbeat(),public.neo_report_error(text),public.neo_admin_access(),public.neo_admin_summary(),public.neo_export_account_metadata(),public.neo_limit_writes() from public,anon;
grant execute on function public.neo_has_consent(text),public.neo_set_consent(text,boolean),public.neo_complete_onboarding(jsonb,jsonb,boolean,boolean),public.neo_migrate_records(jsonb,text),public.neo_heartbeat(),public.neo_report_error(text),public.neo_admin_access(),public.neo_admin_summary(),public.neo_export_account_metadata() to authenticated;
commit;
