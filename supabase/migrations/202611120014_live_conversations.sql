-- Additive: assigned support, scoped moderators, private attachments and per-user realtime signals.
begin;
create table if not exists neo_private.community_moderators(user_id uuid primary key references auth.users(id) on delete cascade,granted_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
alter table neo_private.community_moderators enable row level security;
revoke all on neo_private.community_moderators from public,anon,authenticated;
create or replace function public.neo_is_moderator() returns boolean language sql stable security definer set search_path=pg_catalog as $$select auth.uid() is not null and (public.neo_admin_access() or exists(select 1 from neo_private.community_moderators where user_id=auth.uid()))$$;
revoke all on function public.neo_is_moderator() from public,anon;
grant execute on function public.neo_is_moderator() to authenticated;
-- Change community permissions only: a moderator never receives store/platform administration.
do $roles$ declare r record;begin for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('neo_community','neo_community_chat','neo_community_settings','neo_community_photo_access','neo_community_file_access') loop execute replace(pg_get_functiondef(r.oid),'public.neo_admin_access()','public.neo_is_moderator()');end loop;end $roles$;
create or replace function neo_private.community_auto_approve() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin if new.user_id=auth.uid() and (public.neo_is_moderator() or exists(select 1 from neo_private.community_settings where singleton and not require_approval)) then new.status:='published';end if;return new;end $$;

create table if not exists public.neo_message_events(user_id uuid primary key references auth.users(id) on delete cascade,group_revision bigint not null default 0,direct_revision bigint not null default 0,updated_at timestamptz not null default now());
alter table public.neo_message_events enable row level security;
revoke all on public.neo_message_events from public,anon,authenticated;
grant select on public.neo_message_events to authenticated;
drop policy if exists neo_message_events_own on public.neo_message_events;
create policy neo_message_events_own on public.neo_message_events for select to authenticated using(user_id=auth.uid());
create or replace function neo_private.message_signal(p_users uuid[],p_kind text) returns void language sql security definer set search_path=pg_catalog as $$
 insert into public.neo_message_events(user_id,group_revision,direct_revision) select distinct x.id,case when p_kind='group' then 1 else 0 end,case when p_kind='direct' then 1 else 0 end from unnest(p_users) x(id) join auth.users a on a.id=x.id
 on conflict(user_id) do update set group_revision=neo_message_events.group_revision+excluded.group_revision,direct_revision=neo_message_events.direct_revision+excluded.direct_revision,updated_at=clock_timestamp()
$$;
revoke all on function neo_private.message_signal(uuid[],text) from public,anon,authenticated;
do $realtime$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='neo_message_events') then alter publication supabase_realtime add table public.neo_message_events;end if;end $realtime$;
create or replace function neo_private.group_live_event() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if tg_op='DELETE' or (tg_op='INSERT' and new.status='published') or (tg_op='UPDATE' and (old.status is distinct from new.status or old.body is distinct from new.body)) then perform neo_private.message_signal(array(select user_id from neo_private.community_members),'group');elsif tg_op='INSERT' then perform neo_private.message_signal(array(select user_id from neo_private.admin_members union select user_id from neo_private.community_moderators),'group');end if;
 return null;end $$;
drop trigger if exists neo_group_live_event on neo_private.community_posts;
create trigger neo_group_live_event after insert or update or delete on neo_private.community_posts for each row execute function neo_private.group_live_event();
revoke all on function neo_private.group_live_event() from public,anon,authenticated;

create or replace function neo_private.material_live_event() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin perform neo_private.message_signal(array(select user_id from neo_private.community_members),'group');return null;end $$;
revoke all on function neo_private.material_live_event() from public,anon,authenticated;
drop trigger if exists neo_material_live_event on neo_private.community_materials;
create trigger neo_material_live_event after insert or update or delete on neo_private.community_materials for each row execute function neo_private.material_live_event();
create or replace function neo_private.group_read_event() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin if new.last_seen>old.last_seen then perform neo_private.message_signal(array[new.user_id],'group');end if;return null;end $$;
revoke all on function neo_private.group_read_event() from public,anon,authenticated;
drop trigger if exists neo_group_read_event on neo_private.community_preferences;
create trigger neo_group_read_event after update on neo_private.community_preferences for each row execute function neo_private.group_read_event();
alter table neo_private.support_threads add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table neo_private.support_threads add column if not exists claimed_at timestamptz;
create table if not exists neo_private.support_attachments(path text primary key,thread_id uuid not null references neo_private.support_threads(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,message_id uuid references neo_private.support_messages(id) on delete cascade,name text not null check(length(name) between 1 and 120 and name !~ '[/\\[:cntrl:]]'),mime text not null check(mime in ('image/jpeg','application/pdf','text/plain','audio/webm','audio/mp4','audio/ogg')),size int not null check(size between 1 and 10485760),created_at timestamptz not null default now());
alter table neo_private.support_attachments enable row level security;
revoke all on neo_private.support_attachments from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('neo-support','neo-support',false,10485760,array['image/jpeg','application/pdf','text/plain','audio/webm','audio/mp4','audio/ogg']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.neo_support_access(p_thread uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$select auth.uid() is not null and exists(select 1 from neo_private.support_threads where id=p_thread and (user_id=auth.uid() or (assigned_to=auth.uid() and public.neo_is_moderator())))$$;
create or replace function public.neo_support_attachment_access(p_path text,p_upload boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog as $$select exists(select 1 from neo_private.support_attachments a where a.path=p_path and public.neo_support_access(a.thread_id) and ((p_upload and a.user_id=auth.uid() and a.message_id is null and a.created_at>now()-interval '1 hour') or (not p_upload and (a.message_id is not null or a.user_id=auth.uid()))))$$;
revoke all on function public.neo_support_access(uuid),public.neo_support_attachment_access(text,boolean) from public,anon;
grant execute on function public.neo_support_access(uuid),public.neo_support_attachment_access(text,boolean) to authenticated;
drop policy if exists neo_support_media_read on storage.objects;
create policy neo_support_media_read on storage.objects for select to authenticated using(bucket_id='neo-support' and public.neo_support_attachment_access(name,false));
drop policy if exists neo_support_media_insert on storage.objects;
create policy neo_support_media_insert on storage.objects for insert to authenticated with check(bucket_id='neo-support' and public.neo_support_attachment_access(name,true));
-- Delete only an unsent attachment owned by this account.
create or replace function public.neo_support_attachment_unused(p_path text) returns boolean language sql stable security definer set search_path=pg_catalog as $$select exists(select 1 from neo_private.support_attachments where path=p_path and user_id=auth.uid() and message_id is null)$$;
drop policy if exists neo_support_media_delete on storage.objects;
create policy neo_support_media_delete on storage.objects for delete to authenticated using(bucket_id='neo-support' and public.neo_support_attachment_unused(name));
revoke all on function public.neo_support_attachment_unused(text) from public,anon;
grant execute on function public.neo_support_attachment_unused(text) to authenticated;
create or replace function neo_private.support_live_event() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare users uuid[];begin
 users:=array[new.user_id,new.assigned_to,case when tg_op='UPDATE' then old.assigned_to else null end];
 if new.assigned_to is null or (tg_op='UPDATE' and old.assigned_to is distinct from new.assigned_to) then users:=users||array(select user_id from neo_private.admin_members union select user_id from neo_private.community_moderators);end if;
 perform neo_private.message_signal(users,'direct');return null;end $$;
drop trigger if exists neo_support_live_event on neo_private.support_threads;
create trigger neo_support_live_event after insert or update on neo_private.support_threads for each row execute function neo_private.support_live_event();
revoke all on function neo_private.support_live_event() from public,anon,authenticated;

create or replace function neo_private.support_read_event() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin if tg_op='INSERT' or new.through_seq>old.through_seq then perform neo_private.message_signal(array[new.user_id],'direct');end if;return null;end $$;
revoke all on function neo_private.support_read_event() from public,anon,authenticated;
drop trigger if exists neo_support_read_event on neo_private.support_reads;
create trigger neo_support_read_event after insert or update on neo_private.support_reads for each row execute function neo_private.support_read_event();
create or replace function public.neo_support(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();moderator boolean;tid uuid;mid uuid;before_seq bigint;watermark bigint;body_text text;alias_text text;handler_name text;t neo_private.support_threads;rows jsonb;previous neo_private.support_messages;paths jsonb;f neo_private.support_attachments;target uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 if not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=u) then raise exception 'complete onboarding first';end if;
 moderator:=public.neo_is_moderator();
 if p_action='list' then
  select coalesce(jsonb_agg(x),'[]') into rows from (
   select s.id,s.user_id,s.assigned_to,coalesce(nullif(left((regexp_split_to_array(btrim(p.data->'profile'->>'name'),'\s+'))[1],40),''),'Participante') as alias,s.updated_at,
    s.assigned_to is null as waiting,s.user_id=u as own_thread,
    case when s.assigned_to is null and s.user_id<>u then 'Novo atendimento' else (select left(m.body,120) from neo_private.support_messages m where m.thread_id=s.id order by m.seq desc limit 1) end as preview,
    (select count(*) from neo_private.support_messages m where m.thread_id=s.id and m.sender_id<>u and m.seq>case when s.user_id=u then s.owner_seen else coalesce((select through_seq from neo_private.support_reads r where r.thread_id=s.id and r.user_id=u),0) end) as unread
   from neo_private.support_threads s join public.neo_profiles p on p.user_id=s.user_id
   where s.user_id=u or (moderator and (s.assigned_to=u or (s.assigned_to is null and s.next_seq>0))) order by s.updated_at desc,s.id limit 200
  )x;
  return jsonb_build_object('is_moderator',moderator,'threads',rows);
 end if;
 if p_action='start' then
  if not moderator then raise exception 'moderator required' using errcode='42501';end if;
  target:=(p_payload->>'user_id')::uuid;
  if target=u or not exists(select 1 from neo_private.community_members where user_id=target) then raise exception 'invalid participant';end if;
  perform neo_private.take_limit('support_start',60,3600);
  insert into neo_private.support_threads(user_id) values(target) on conflict(user_id) do nothing;
  select id into tid from neo_private.support_threads where user_id=target;
 else tid:=nullif(p_payload->>'thread_id','')::uuid;end if;
 if tid is null and p_action in ('open','send','reserve') then
  insert into neo_private.support_threads(user_id) values(u) on conflict(user_id) do nothing;
  select id into tid from neo_private.support_threads where user_id=u;
 end if;
 select * into t from neo_private.support_threads where id=tid for update;
 if not found then raise exception 'conversation access denied' using errcode='42501';end if;
 if p_action in ('claim','start') then
  if not moderator or t.user_id=u then raise exception 'moderator required' using errcode='42501';end if;
  if t.assigned_to is not null and t.assigned_to<>u then raise exception 'Este atendimento já foi assumido por outro mediador.' using errcode='42501';end if;
  update neo_private.support_threads set assigned_to=u,claimed_at=coalesce(claimed_at,now()) where id=tid;
  return jsonb_build_object('thread_id',tid,'ok',true);
 end if;
 if not public.neo_support_access(tid) then raise exception 'conversation access denied' using errcode='42501';end if;
 if p_action='reserve' then
  perform neo_private.take_limit('support_attachment',40,3600);
  paths:=to_jsonb(u::text||'/'||gen_random_uuid()::text||case p_payload->>'mime' when 'image/jpeg' then '.jpg' when 'application/pdf' then '.pdf' when 'text/plain' then '.txt' when 'audio/mp4' then '.m4a' when 'audio/ogg' then '.ogg' else '.webm' end);
  insert into neo_private.support_attachments(path,thread_id,user_id,name,mime,size) values(paths#>>'{}',tid,u,p_payload->>'name',p_payload->>'mime',(p_payload->>'size')::int);
  return jsonb_build_object('path',paths,'thread_id',tid);
 elsif p_action='send' then
  body_text:=btrim(coalesce(p_payload->>'body',''));mid:=(p_payload->>'id')::uuid;paths:=coalesce(p_payload->'attachments','[]');
  if length(body_text)>4000 or mid is null or jsonb_typeof(paths)<>'array' or jsonb_array_length(paths)>4 or (body_text='' and jsonb_array_length(paths)=0) then raise exception 'invalid message';end if;
  if body_text='' then body_text:='Anexo';end if;
  select * into previous from neo_private.support_messages where id=mid;
  if found then
   if previous.thread_id=tid and previous.sender_id=u and previous.body=body_text and (select coalesce(jsonb_agg(path order by path),'[]') from neo_private.support_attachments where message_id=mid)=(select coalesce(jsonb_agg(value order by value),'[]') from jsonb_array_elements(paths)) then return jsonb_build_object('ok',true,'thread_id',tid,'id',mid);end if;
   raise exception 'message conflict';end if;
  if (select count(distinct value) from jsonb_array_elements_text(paths))<>jsonb_array_length(paths) then raise exception 'invalid attachments';end if;
  for f in select * from neo_private.support_attachments where path in(select jsonb_array_elements_text(paths)) for update loop
   if f.user_id<>u or f.thread_id<>tid or f.message_id is not null or not exists(select 1 from storage.objects where bucket_id='neo-support' and name=f.path) then raise exception 'invalid attachment';end if;
  end loop;
  if (select count(*) from neo_private.support_attachments where path in(select jsonb_array_elements_text(paths)))<>jsonb_array_length(paths) then raise exception 'invalid attachment';end if;
  perform neo_private.take_limit('support_send',60,60);
  select left((regexp_split_to_array(btrim(data->'profile'->>'name'),'\s+'))[1],40) into alias_text from public.neo_profiles where user_id=u;
  update neo_private.support_threads set next_seq=next_seq+1,updated_at=clock_timestamp() where id=tid returning next_seq into watermark;
  insert into neo_private.support_messages(id,thread_id,sender_id,sender_alias,sender_type,seq,body) values(mid,tid,u,coalesce(nullif(alias_text,''),'Participante'),case when t.assigned_to=u then 'team' else 'member' end,watermark,body_text);
  update neo_private.support_attachments set message_id=mid where path in(select jsonb_array_elements_text(paths));
  return jsonb_build_object('ok',true,'thread_id',tid,'id',mid);
 elsif p_action='open' then
  before_seq:=coalesce((p_payload->>'before')::bigint,0);watermark:=t.next_seq;
  if before_seq<0 then raise exception 'invalid history cursor';end if;
  select coalesce(jsonb_agg(x order by x.seq),'[]') into rows from (
   select m.id,m.seq,m.body,m.created_at,m.sender_alias as alias,m.sender_type,m.sender_id=u as own,
    (select coalesce(jsonb_agg(jsonb_build_object('path',a.path,'name',a.name,'mime',a.mime,'size',a.size)),'[]') from neo_private.support_attachments a where a.message_id=m.id) as attachments
   from neo_private.support_messages m where m.thread_id=tid and m.seq<=watermark and (before_seq=0 or m.seq<before_seq) order by m.seq desc limit 100
  )x;
  if before_seq=0 then
   if t.user_id=u then update neo_private.support_threads set owner_seen=greatest(owner_seen,watermark) where id=tid and owner_seen<watermark;
   else insert into neo_private.support_reads(thread_id,user_id,through_seq) values(tid,u,watermark) on conflict(thread_id,user_id) do update set through_seq=greatest(support_reads.through_seq,excluded.through_seq);end if;
  end if;
  select left((regexp_split_to_array(btrim(data->'profile'->>'name'),'\s+'))[1],40) into alias_text from public.neo_profiles where user_id=t.user_id;
  select left((regexp_split_to_array(btrim(data->'profile'->>'name'),'\s+'))[1],40) into handler_name from public.neo_profiles where user_id=t.assigned_to;
  return jsonb_build_object('is_moderator',moderator,'thread_id',tid,'alias',coalesce(alias_text,'Participante'),'own_thread',t.user_id=u,'handler',handler_name,'assigned',t.assigned_to is not null,'messages',rows,'has_more',exists(select 1 from neo_private.support_messages where thread_id=tid and seq<coalesce((rows->0->>'seq')::bigint,0)));
 else raise exception 'invalid support action';end if;
end $$;
revoke all on function public.neo_support(text,jsonb) from public,anon;
grant execute on function public.neo_support(text,jsonb) to authenticated;

create or replace function public.neo_community_members(p_action text default 'list',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();target uuid;result jsonb;term text:=left(coalesce(p_payload->>'search',''),40);
begin
 if u is null or not exists(select 1 from neo_private.community_members where user_id=u) then raise exception 'community membership required' using errcode='42501';end if;
 target:=nullif(p_payload->>'user_id','')::uuid;
 if p_action in ('promote','demote') then
  if not public.neo_admin_access() then raise exception 'administrator required' using errcode='42501';end if;
  if target=u or exists(select 1 from neo_private.admin_members where user_id=target) or not exists(select 1 from neo_private.community_members where user_id=target) then raise exception 'invalid role target';end if;
  perform neo_private.take_limit('community_roles',30,3600);
  if p_action='promote' then insert into neo_private.community_moderators(user_id,granted_by) values(target,u) on conflict do nothing;
  else delete from neo_private.community_moderators where user_id=target;update neo_private.support_threads set assigned_to=null,claimed_at=null where assigned_to=target;end if;
  perform neo_private.message_signal(array[target],'group');
 elsif p_action not in ('list','profile') then raise exception 'invalid member action';end if;
 select coalesce(jsonb_agg(x),'[]') into result from (
  select m.user_id,m.alias,m.joined_at,case when exists(select 1 from neo_private.admin_members a where a.user_id=m.user_id) then 'admin' when exists(select 1 from neo_private.community_moderators a where a.user_id=m.user_id) then 'moderator' else 'member' end as role
  from neo_private.community_members m where (p_action<>'profile' or m.user_id=target) and (term='' or m.alias ilike '%'||term||'%') order by m.alias,m.user_id limit 200
 )x;
 return jsonb_build_object('members',result,'can_manage_roles',public.neo_admin_access(),'can_contact',public.neo_is_moderator());
end $$;
revoke all on function public.neo_community_members(text,jsonb) from public,anon;
grant execute on function public.neo_community_members(text,jsonb) to authenticated;
-- Enrich an authorized feed only; never expose health profiles.
do $enrich$ begin if to_regprocedure('public.neo_community_inbox_v3()') is null then alter function public.neo_community_inbox_v2() rename to neo_community_inbox_v3;end if;end $enrich$;
create or replace function public.neo_community_inbox_v2() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare feed jsonb;section text;enriched jsonb;item jsonb;sender uuid;begin
 feed:=public.neo_community_inbox_v3();
 foreach section in array array['posts','pending'] loop enriched:='[]';for item in select value from jsonb_array_elements(coalesce(feed->section,'[]')) loop select user_id into sender from neo_private.community_posts where id=(item->>'id')::uuid;enriched:=enriched||jsonb_build_array(item||jsonb_build_object('user_id',sender));end loop;feed:=jsonb_set(feed,array[section],enriched);end loop;
 return feed||jsonb_build_object('can_moderate',public.neo_is_moderator());end $$;
revoke all on function public.neo_community_inbox_v2() from public,anon;
grant execute on function public.neo_community_inbox_v2() to authenticated;
-- Exports remain owner-only, now include private attachment metadata.
create or replace function public.neo_support_export() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare u uuid:=auth.uid();result jsonb;begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 select coalesce(jsonb_agg(x),'[]') into result from(select t.id,t.created_at,(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'alias',m.sender_alias,'sender_type',m.sender_type,'created_at',m.created_at,'attachments',(select coalesce(jsonb_agg(jsonb_build_object('path',a.path,'name',a.name,'mime',a.mime,'size',a.size)),'[]') from neo_private.support_attachments a where a.message_id=m.id)) order by m.seq),'[]') from neo_private.support_messages m where m.thread_id=t.id) as messages from neo_private.support_threads t where t.user_id=u)x;return result;end $$;
-- Called only by authenticated delete-account Edge handler with the verified account id.
create or replace function public.neo_support_deletion_media(p_user uuid) returns jsonb language sql security definer set search_path=pg_catalog as $$select coalesce(jsonb_agg(a.path),'[]') from neo_private.support_attachments a join neo_private.support_threads t on t.id=a.thread_id where a.user_id=p_user or t.user_id=p_user$$;
revoke all on function public.neo_support_deletion_media(uuid) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.neo_support_deletion_media(uuid) to service_role';end if;end $$;
notify pgrst,'reload schema';
commit;
