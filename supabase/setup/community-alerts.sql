-- NeoPeptídeos: contadores e preferências. Não envia notificações por si só.
-- Executar no SQL Editor do mesmo projeto. Preserva registros e autorizações.
begin;
do $install_push$
begin
 if to_regclass('neo_private.push_devices') is null then
  execute $push_sql$
create table if not exists neo_private.push_devices(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,endpoint text unique not null,keys jsonb not null,timezone text not null,created_at timestamptz not null default now());
create table if not exists neo_private.push_jobs(id uuid primary key default gen_random_uuid(),device_id uuid not null references neo_private.push_devices(id) on delete cascade,reminder_key text not null,local_day date not null,sent boolean not null default false,lease_until timestamptz,attempts int not null default 0,unique(device_id,reminder_key,local_day));
alter table neo_private.push_devices enable row level security;
alter table neo_private.push_jobs enable row level security;
revoke all on neo_private.push_devices,neo_private.push_jobs from public,anon,authenticated;
create or replace function public.neo_push_device(p_action text,p_subscription jsonb default '{}',p_timezone text default 'UTC') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); ep text:=p_subscription->>'endpoint'; device uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 if p_action='remove' then delete from neo_private.push_devices where user_id=u and endpoint=ep;return '{"ok":true}';end if;
 if p_action<>'register' then raise exception 'invalid push action';end if;
 if not public.neo_has_consent('health') or not public.neo_has_consent('terms') then raise exception 'consent required';end if;
 perform neo_private.take_limit('push_register',20,3600);
 if ep is null or length(ep)>2048 or ep !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[A-Za-z0-9_/?=&%:.~-]+$' then raise exception 'invalid push endpoint';end if;
 if (p_subscription->'keys'->>'p256dh') is null or (p_subscription->'keys'->>'p256dh') !~ '^[A-Za-z0-9_-]{87}=?$' or (p_subscription->'keys'->>'auth') is null or (p_subscription->'keys'->>'auth') !~ '^[A-Za-z0-9_-]{22}={0,2}$' then raise exception 'invalid push keys';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'invalid timezone';end if;
 if (select count(*) from neo_private.push_devices where user_id=u)>=10 and not exists(select 1 from neo_private.push_devices where endpoint=ep and user_id=u) then raise exception 'device limit reached';end if;
 -- A subscription cannot be silently reassigned to another account.
 if exists(select 1 from neo_private.push_devices where endpoint=ep and user_id<>u) then raise exception 'subscription belongs to another account; disable notifications first';end if;
 insert into neo_private.push_devices(user_id,endpoint,keys,timezone) values(u,ep,p_subscription->'keys',p_timezone) on conflict(endpoint) do update set timezone=excluded.timezone,keys=excluded.keys returning id into device;
 return jsonb_build_object('ok',true,'device_id',device);
end $$;
create or replace function public.neo_push_claim() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 -- Only the service role may call this RPC; endpoints never reach the admin UI.
 perform pg_advisory_xact_lock(642917123);
 delete from neo_private.push_jobs where local_day<current_date-7;
 with devices as(select d.*,p.data,(now() at time zone d.timezone)::date as day from neo_private.push_devices d join public.neo_profiles p on p.user_id=d.user_id where exists(select 1 from public.neo_consents c where c.user_id=d.user_id and c.purpose='health' and c.granted) and exists(select 1 from public.neo_consents c where c.user_id=d.user_id and c.purpose='terms' and c.granted)),
 schedules as(
 select d.id as device_id,d.day,d.timezone,'weight'::text as key,d.data->'settings'->>'weightTime' as time from devices d where coalesce((d.data->'profile'->'tracking'->>'weight')::boolean,true) and not exists(select 1 from public.neo_records r where r.user_id=d.user_id and r.kind='weights' and r.data->>'date'=d.day::text)
 union all select d.id,d.day,d.timezone,'measure',d.data->'settings'->>'measureTime' from devices d where coalesce((d.data->'profile'->'tracking'->>'measures')::boolean,true) and extract(dow from d.day)::text=d.data->'settings'->>'measureDay' and not exists(select 1 from public.neo_records r where r.user_id=d.user_id and r.kind='measures' and r.data->>'date'=d.day::text)
 union all select d.id,d.day,d.timezone,'custom:'||r.id,r.data->>'time' from devices d join public.neo_records r on r.user_id=d.user_id and r.kind='reminders' where r.data->'enabled'='true'::jsonb and (r.data->>'date')::date<=d.day and (r.data->>'repeat'='daily' or (r.data->>'repeat'='once' and (r.data->>'date')::date=d.day) or (r.data->>'repeat'='weekly' and (r.data->>'weekday')::int=extract(dow from d.day)))
 ),due as(select device_id,key,day from schedules where (day+time::time) at time zone timezone between now()-interval '10 minutes' and now()),
 inserted as(insert into neo_private.push_jobs(device_id,reminder_key,local_day) select device_id,key,day from due on conflict do nothing returning id)
 select coalesce(jsonb_agg(to_jsonb(due)),'[]'::jsonb) into result from due;
 -- The insert above and subsequent statement use separate snapshots deliberately.
 with candidates as(select j.id from neo_private.push_jobs j where not j.sent and j.attempts<3 and (j.lease_until is null or j.lease_until<now()) and exists(select 1 from jsonb_array_elements(result) d where (d->>'device_id')::uuid=j.device_id and d->>'key'=j.reminder_key and (d->>'day')::date=j.local_day) order by j.local_day,j.id limit 20),
 claimed as(update neo_private.push_jobs j set lease_until=now()+interval '5 minutes',attempts=attempts+1 from candidates c where j.id=c.id returning j.id,j.device_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'endpoint',d.endpoint,'keys',d.keys)),'[]'::jsonb) into result from claimed j join neo_private.push_devices d on d.id=j.device_id;
 return result;
end $$;
create or replace function public.neo_push_finish(p_id uuid,p_outcome text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_outcome='gone' then delete from neo_private.push_devices where id=(select device_id from neo_private.push_jobs where id=p_id);
 elsif p_outcome='sent' then update neo_private.push_jobs set sent=true where id=p_id;
 elsif p_outcome<>'retry' then raise exception 'invalid push outcome';end if;
end $$;
revoke all on function public.neo_push_device(text,jsonb,text),public.neo_push_claim(),public.neo_push_finish(uuid,text) from public,anon,authenticated;
grant execute on function public.neo_push_device(text,jsonb,text) to authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.neo_push_claim(),public.neo_push_finish(uuid,text) to service_role';end if;end$$;
$push_sql$;
 end if;
end $install_push$;

create sequence if not exists neo_private.community_publication_seq;
alter table neo_private.community_posts add column if not exists published_seq bigint;
alter table neo_private.community_posts add column if not exists published_at timestamptz;
update neo_private.community_posts set published_seq=nextval('neo_private.community_publication_seq') where status='published' and published_seq is null;
create unique index if not exists neo_community_publication_unique on neo_private.community_posts(published_seq);
create or replace function neo_private.community_publish_event() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if new.status='published' and new.published_seq is null then new.published_seq:=nextval('neo_private.community_publication_seq');new.published_at:=now();end if;return new;
end $$;
drop trigger if exists neo_community_publication on neo_private.community_posts;
create trigger neo_community_publication before insert or update on neo_private.community_posts for each row execute function neo_private.community_publish_event();
create table if not exists neo_private.community_preferences(user_id uuid primary key references neo_private.community_members(user_id) on delete cascade,last_seen bigint not null default 0,push_enabled boolean not null default false,activated_after bigint not null default 0);
create table if not exists neo_private.community_push_jobs(id uuid primary key default gen_random_uuid(),device_id uuid not null references neo_private.push_devices(id) on delete cascade,post_id uuid not null references neo_private.community_posts(id) on delete cascade,sent boolean not null default false,attempts int not null default 0,lease_until timestamptz,unique(device_id,post_id));
alter table neo_private.community_preferences enable row level security;
alter table neo_private.community_push_jobs enable row level security;
revoke all on neo_private.community_preferences,neo_private.community_push_jobs from public,anon,authenticated;
revoke all on sequence neo_private.community_publication_seq from public,anon,authenticated;
revoke all on function neo_private.community_publish_event() from public,anon,authenticated;
create or replace function public.neo_community_activity(p_action text default 'status',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); seq bigint; seen bigint; enabled boolean; total bigint; unread bigint;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 if not exists(select 1 from neo_private.community_members where user_id=u) then return '{"total":0,"unread":0,"latest":0,"push_enabled":false,"member":false}';end if;
 select coalesce(max(published_seq),0),count(*) into seq,total from neo_private.community_posts where status='published';
 if p_action='seen' then
  seen:=(p_payload->>'through')::bigint;if seen is null or seen<0 or seen>seq then raise exception 'invalid read watermark';end if;
  insert into neo_private.community_preferences(user_id,last_seen) values(u,seen) on conflict(user_id) do update set last_seen=greatest(community_preferences.last_seen,excluded.last_seen);
 elsif p_action='preferences' then
  if jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'invalid notification preference';end if;
  enabled:=(p_payload->>'enabled')::boolean;
  insert into neo_private.community_preferences(user_id,push_enabled,activated_after) values(u,enabled,seq) on conflict(user_id) do update set push_enabled=excluded.push_enabled,activated_after=case when not community_preferences.push_enabled and excluded.push_enabled then excluded.activated_after else community_preferences.activated_after end;
 elsif p_action<>'status' then raise exception 'invalid activity action';end if;
 select coalesce(p.last_seen,0),coalesce(p.push_enabled,false) into seen,enabled from neo_private.community_preferences p where user_id=u;
 select count(*) into unread from neo_private.community_posts where status='published' and published_seq>coalesce(seen,0) and user_id<>u;
 return jsonb_build_object('total',total,'unread',unread,'latest',seq,'push_enabled',coalesce(enabled,false),'member',true);
end $$;
create or replace function public.neo_community_inbox() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare info jsonb;feed jsonb;
begin
 -- Capture the watermark before reading the feed: never acknowledge a later publication.
 info:=public.neo_community_activity('status');feed:=public.neo_community_chat('read');return feed||jsonb_build_object('activity',info);
end $$;
create or replace function public.neo_community_push_claim() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(642917124);
 delete from neo_private.community_push_jobs j using neo_private.community_posts p where j.post_id=p.id and p.published_at<now()-interval '1 day';
 insert into neo_private.community_push_jobs(device_id,post_id)
 select d.id,p.id from neo_private.push_devices d join neo_private.community_members m on m.user_id=d.user_id join neo_private.community_preferences pref on pref.user_id=d.user_id and pref.push_enabled join neo_private.community_posts p on p.status='published' and p.user_id<>d.user_id and p.published_seq>pref.activated_after and p.published_seq>pref.last_seen and p.published_at between now()-interval '10 minutes' and now()
 where d.created_at<=p.published_at on conflict do nothing;
 with candidates as(select j.id from neo_private.community_push_jobs j join neo_private.push_devices d on d.id=j.device_id join neo_private.community_members m on m.user_id=d.user_id join neo_private.community_preferences pref on pref.user_id=d.user_id and pref.push_enabled join neo_private.community_posts p on p.id=j.post_id and p.status='published' and p.published_seq>pref.last_seen and p.published_seq>pref.activated_after and p.published_at>=now()-interval '10 minutes' where not j.sent and j.attempts<3 and (j.lease_until is null or j.lease_until<now()) order by p.published_at,j.id limit 20),
 claimed as(update neo_private.community_push_jobs j set attempts=attempts+1,lease_until=now()+interval '5 minutes' from candidates c where j.id=c.id returning j.id,j.device_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'endpoint',d.endpoint,'keys',d.keys,'kind','community')),'[]'::jsonb) into result from claimed j join neo_private.push_devices d on d.id=j.device_id;
 return result;
end $$;
create or replace function public.neo_community_push_finish(p_id uuid,p_outcome text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_outcome='gone' then delete from neo_private.push_devices where id=(select device_id from neo_private.community_push_jobs where id=p_id);
 elsif p_outcome='sent' then update neo_private.community_push_jobs set sent=true where id=p_id;
 elsif p_outcome<>'retry' then raise exception 'invalid outcome';end if;
end $$;
revoke all on function public.neo_community_activity(text,jsonb),public.neo_community_inbox(),public.neo_community_push_claim(),public.neo_community_push_finish(uuid,text) from public,anon,authenticated;
grant execute on function public.neo_community_activity(text,jsonb),public.neo_community_inbox() to authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.neo_community_push_claim(),public.neo_community_push_finish(uuid,text) to service_role';end if;end$$;

commit;
